const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// --- REDIRECT ROOT to HOME PAGE ---
app.get('/', (req, res) => {
    res.redirect('/index.html');
});

// --- DATABASE CONNECTION ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// --- SECRET KEY FOR JWT ---
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-fallback';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- DATABASE INITIALIZATION ---
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        console.log("Connecting to database...");
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(10) NOT NULL CHECK (role IN ('student', 'admin'))
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS quizzes (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                created_by INT REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS questions (
                id SERIAL PRIMARY KEY,
                quiz_id INT REFERENCES quizzes(id) ON DELETE CASCADE,
                question_text TEXT NOT NULL,
                options JSONB NOT NULL,
                correct_option INT NOT NULL
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS scores (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                quiz_id INT REFERENCES quizzes(id) ON DELETE CASCADE,
                score INT NOT NULL,
                total INT NOT NULL,
                taken_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        console.log("Database tables checked/created.");

        const salt = await bcrypt.genSalt(10);
        
        const adminCheck = await client.query("SELECT * FROM users WHERE username = 'admin'");
        if (adminCheck.rowCount === 0) {
            const adminHash = await bcrypt.hash('admin123', salt);
            await client.query("INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin')", ['admin', adminHash]);
            console.log("Default admin user created. (admin/admin123)");
        }
        
        const studentCheck = await client.query("SELECT * FROM users WHERE username = 'student'");
        if (studentCheck.rowCount === 0) {
            const studentHash = await bcrypt.hash('student123', salt);
            await client.query("INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'student')", ['student', studentHash]);
            console.log("Default student user created. (student/student123)");
        }

    } catch (err) {
        console.error("Database initialization error:", err.stack);
    } finally {
        client.release();
    }
}

// --- Helper function for API calls with exponential backoff ---
const fetchWithBackoff = async (url, options, retries = 5, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status === 429 || response.status >= 500) {
                throw new Error(`APIError status:${response.status}`);
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `APIError status:${response.status}`);
            }
            return await response.json();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
        }
    }
};

// --- AUTH MIDDLEWARE ---
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// --- AUTH ROUTES ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const tokenPayload = { id: user.id, username: user.username, role: user.role };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });

        res.json({ message: "Login successful", token, user: tokenPayload });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

app.post('/api/register', async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ message: "All fields are required." });
    }
    if (role !== 'student' && role !== 'admin') {
        return res.status(400).json({ message: "Invalid role. Must be 'student' or 'admin'." });
    }

    try {
        const userCheck = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (userCheck.rowCount > 0) {
            return res.status(409).json({ message: "Username already exists." });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = await pool.query(
            "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role",
            [username, passwordHash, role]
        );

        res.status(201).json({ 
            message: "User registered successfully. Please login.",
            user: newUser.rows[0]
        });

    } catch (err) {
        console.error("Registration error:", err);
        res.status(500).json({ message: "Server error during registration." });
    }
});

// --- ADMIN ROUTES ---

// Create quiz with AI
app.post('/api/quizzes', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access forbidden: Admins only." });
    }

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ message: "Server is missing API key configuration." });
    }

    const { title, aiPrompt } = req.body;
    const client = await pool.connect();
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
    
    const quizSchema = {
        type: "ARRAY",
        items: {
            type: "OBJECT",
            properties: {
                "question_text": { "type": "STRING" },
                "options": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "text": { "type": "STRING" }
                        },
                        "required": ["text"]
                    }
                },
                "correct_option": { 
                    "type": "NUMBER",
                    "description": "The 0-based index of the correct option in the 'options' array."
                }
            },
            "required": ["question_text", "options", "correct_option"]
        }
    };
    
    const payload = {
        contents: [{ 
            parts: [{ 
                text: `Generate a quiz based on the following topic: "${aiPrompt}". 
                
                Please provide the output in the requested JSON format. 
                
                - The quiz should have a reasonable number of questions (e.g., 5-10) unless specified otherwise.
                - Each question must have between 3 and 5 multiple-choice options.
                - Each question must have exactly one correct answer, indicated by the 'correct_option' index.` 
            }] 
        }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: quizSchema
        }
    };

    try {
        const apiResponse = await fetchWithBackoff(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const candidate = apiResponse.candidates?.[0];
        const jsonText = candidate?.content?.parts?.[0]?.text;

        if (!jsonText) {
            throw new Error("Invalid response structure from AI service.");
        }
        
        const questions = JSON.parse(jsonText);
        
        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error("AI did not return any questions.");
        }
        
        await client.query('BEGIN');

        const quizResult = await client.query(
            "INSERT INTO quizzes (title, created_by) VALUES ($1, $2) RETURNING id",
            [title, req.user.id]
        );
        const quizId = quizResult.rows[0].id;

        for (const q of questions) {
            if (!q.question_text || !Array.isArray(q.options) || q.options.length < 2 || typeof q.correct_option !== 'number' || q.correct_option < 0 || q.correct_option >= q.options.length) {
                console.warn("Skipping malformed question from AI:", q);
                continue;
            }
            
            await client.query(
                "INSERT INTO questions (quiz_id, question_text, options, correct_option) VALUES ($1, $2, $3, $4)",
                [quizId, q.question_text, JSON.stringify(q.options), q.correct_option]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: "Quiz created successfully!", quizId: quizId });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Quiz creation error:", err);
        if (err.message.includes("APIError")) {
             res.status(502).json({ message: "Failed to communicate with AI service. " + err.message });
        } else if (err.message.includes("JSON.parse")) {
             res.status(502).json({ message: "Failed to parse AI response. " + err.message });
        } else {
             res.status(500).json({ message: "Error creating quiz: " + err.message });
        }
    } finally {
        client.release();
    }
});

// NEW: Get all quizzes for admin (with question count and attempt count)
app.get('/api/admin/quizzes', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access forbidden: Admins only." });
    }

    try {
        const result = await pool.query(`
            SELECT 
                q.id, 
                q.title, 
                q.created_at,
                u.username as created_by,
                COUNT(DISTINCT qs.id) as question_count,
                COUNT(DISTINCT s.id) as attempt_count
            FROM quizzes q
            LEFT JOIN users u ON q.created_by = u.id
            LEFT JOIN questions qs ON q.id = qs.quiz_id
            LEFT JOIN scores s ON q.id = s.quiz_id
            GROUP BY q.id, q.title, q.created_at, u.username
            ORDER BY q.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// NEW: Delete a quiz
app.delete('/api/admin/quizzes/:id', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access forbidden: Admins only." });
    }

    const { id } = req.params;
    try {
        const result = await pool.query("DELETE FROM quizzes WHERE id = $1 RETURNING id", [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Quiz not found" });
        }
        res.json({ message: "Quiz deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// NEW: Get students who attempted a specific quiz
app.get('/api/admin/quizzes/:id/attempts', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access forbidden: Admins only." });
    }

    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT 
                s.id,
                u.username,
                s.score,
                s.total,
                s.taken_at,
                ROUND((s.score::numeric / s.total::numeric) * 100) as percentage
            FROM scores s
            JOIN users u ON s.user_id = u.id
            WHERE s.quiz_id = $1
            ORDER BY s.taken_at DESC
        `, [id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// --- STUDENT ROUTES ---

// Get all available quizzes (with search support)
app.get('/api/quizzes', verifyToken, async (req, res) => {
    try {
        const { search } = req.query;
        let query = "SELECT id, title, created_at FROM quizzes";
        let params = [];
        
        if (search) {
            query += " WHERE LOWER(title) LIKE LOWER($1)";
            params.push(`%${search}%`);
        }
        
        query += " ORDER BY created_at DESC";
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Get a specific quiz (questions only, no answers)
app.get('/api/quizzes/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const quizRes = await pool.query("SELECT id, title FROM quizzes WHERE id = $1", [id]);
        if (quizRes.rowCount === 0) {
            return res.status(404).json({ message: "Quiz not found" });
        }

        const questionsRes = await pool.query(
            "SELECT id, question_text, options FROM questions WHERE quiz_id = $1",
            [id]
        );

        res.json({
            quiz: quizRes.rows[0],
            questions: questionsRes.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Submit a quiz
app.post('/api/submit/:id', verifyToken, async (req, res) => {
    const quizId = req.params.id;
    const userId = req.user.id;
    const { answers } = req.body;

    try {
        const correctAnswersRes = await pool.query(
            "SELECT id, correct_option FROM questions WHERE quiz_id = $1",
            [quizId]
        );
        const correctAnswers = correctAnswersRes.rows;

        let score = 0;
        const total = correctAnswers.length;

        const answerMap = new Map();
        correctAnswers.forEach(a => answerMap.set(a.id, a.correct_option));

        for (const submitted of answers) {
            if (answerMap.get(submitted.questionId) === submitted.answerIndex) {
                score++;
            }
        }
        
        await pool.query(
            "INSERT INTO scores (user_id, quiz_id, score, total) VALUES ($1, $2, $3, $4)",
            [userId, quizId, score, total]
        );

        res.status(201).json({
            message: "Quiz submitted!",
            score: score,
            total: total
        });
    } catch (err) {
        console.error("Quiz submission error:", err);
        res.status(500).json({ message: "Error submitting quiz." });
    }
});

// Get student's scores
app.get('/api/scores', verifyToken, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ message: "Access forbidden: Students only." });
    }
    
    try {
        const scoresRes = await pool.query(
            `SELECT q.title, s.score, s.total, s.taken_at 
             FROM scores s
             JOIN quizzes q ON s.quiz_id = q.id
             WHERE s.user_id = $1
             ORDER BY s.taken_at DESC`,
            [req.user.id]
        );
        res.json(scoresRes.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// --- START SERVER ---
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    initializeDatabase();
});
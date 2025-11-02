// Utility to show messages
const showMessage = (message, type = 'error') => {
    const messageBox = document.getElementById('message-box');
    if (!messageBox) { // Message box might not exist on this page
        console.log(message);
        return;
    }
    messageBox.textContent = message;
    messageBox.className = type; // 'error' or 'success'
    messageBox.classList.add('show');

    setTimeout(() => {
        messageBox.classList.remove('show');
    }, 3000);
};

// Check auth on page load
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user || user.role !== 'student') {
        localStorage.clear();
        window.location.href = '/login.html';
        return;
    }

    // Personalize
    document.getElementById('welcome-user').textContent = `Welcome, ${user.username}!`;

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/login.html';
    });

    // --- Fetch and Display Quizzes ---
    async function loadQuizzes() {
        try {
            const response = await fetch('/api/quizzes', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch quizzes.');

            const quizzes = await response.json();
            const quizList = document.getElementById('quiz-list');
            const noQuizzes = document.getElementById('no-quizzes');

            if (quizzes.length === 0) {
                noQuizzes.classList.remove('hidden');
                return;
            }

            noQuizzes.classList.add('hidden');
            quizList.innerHTML = ''; // Clear loading/default text

            quizzes.forEach(quiz => {
                const quizElement = document.createElement('div');
                quizElement.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200';
                quizElement.innerHTML = `
                    <span class="font-medium text-gray-700">${quiz.title}</span>
                    <button data-id="${quiz.id}" 
                            class="take-quiz-btn bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                        Take Quiz
                    </button>
                `;
                quizList.appendChild(quizElement);
            });

            // Add event listeners to "Take Quiz" buttons
            document.querySelectorAll('.take-quiz-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const quizId = e.target.getAttribute('data-id');
                    // Store quiz ID and redirect to the quiz page
                    localStorage.setItem('currentQuizId', quizId);
                    window.location.href = '/quiz.html';
                });
            });

        } catch (error) {
            console.error('Error loading quizzes:', error);
            showMessage(error.message, 'error');
        }
    }

    // --- Fetch and Display Scores ---
    async function loadScores() {
        try {
            const response = await fetch('/api/scores', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch scores.');

            const scores = await response.json();
            const scoreList = document.getElementById('score-list');
            const noScores = document.getElementById('no-scores');

            if (scores.length === 0) {
                noScores.classList.remove('hidden');
                return;
            }
            
            noScores.classList.add('hidden');
            scoreList.innerHTML = ''; // Clear loading/default text

            scores.forEach(score => {
                const scoreElement = document.createElement('div');
                scoreElement.className = 'p-4 bg-gray-50 rounded-lg border border-gray-200';
                
                const percentage = Math.round((score.score / score.total) * 100);
                const date = new Date(score.taken_at).toLocaleDateString();

                scoreElement.innerHTML = `
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-medium text-gray-800">${score.title}</span>
                        <span class="font-bold text-lg ${percentage >= 70 ? 'text-green-600' : 'text-red-600'}">${percentage}%</span>
                    </div>
                    <div class="flex justify-between items-center text-sm text-gray-500">
                        <span>Score: ${score.score} / ${score.total}</span>
                        <span>${date}</span>
                    </div>
                `;
                scoreList.appendChild(scoreElement);
            });

        } catch (error) {
            console.error('Error loading scores:', error);
            showMessage(error.message, 'error');
        }
    }

    loadQuizzes();
    loadScores();
});

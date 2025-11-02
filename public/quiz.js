// Utility to show messages
const showMessage = (message, type = 'error') => {
    const messageBox = document.getElementById('message-box');
    messageBox.textContent = message;
    messageBox.className = type; // 'error' or 'success'
    messageBox.classList.add('show');

    setTimeout(() => {
        messageBox.classList.remove('show');
    }, 3000);
};

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    const quizId = localStorage.getItem('currentQuizId');

    // Auth check
    if (!token || !user || user.role !== 'student') {
        localStorage.clear();
        window.location.href = '/login.html';
        return;
    }
    
    // Quiz ID check
    if (!quizId) {
        window.location.href = '/student.html';
        return;
    }

    document.getElementById('welcome-user').textContent = `User: ${user.username}`;
    
    const quizForm = document.getElementById('quiz-form');
    const questionsContainer = document.getElementById('questions-container');
    const quizTitle = document.getElementById('quiz-title');

    // --- Load the Quiz ---
    try {
        const response = await fetch(`/api/quizzes/${quizId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Failed to load quiz.');
        }

        const data = await response.json();
        quizTitle.textContent = data.quiz.title;
        
        // Populate questions
        data.questions.forEach((q, index) => {
            const questionElement = document.createElement('div');
            questionElement.className = 'question-block';
            questionElement.setAttribute('data-question-id', q.id);

            // Generate options HTML
            const optionsHTML = q.options.map((opt, optIndex) => `
                <label for="q${q.id}-opt${optIndex}" 
                       class="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition">
                    <input type="radio" id="q${q.id}-opt${optIndex}" name="question-${q.id}" value="${optIndex}" 
                           class="w-5 h-5 text-blue-600 focus:ring-blue-500 border-gray-300">
                    <span class="ml-4 text-gray-700">${opt.text}</span>
                </label>
            `).join('');

            questionElement.innerHTML = `
                <p class="text-lg font-semibold text-gray-800 mb-4">
                    ${index + 1}. ${q.question_text}
                </p>
                <div class="space-y-3">
                    ${optionsHTML}
                </div>
            `;
            questionsContainer.appendChild(questionElement);
        });

    } catch (error) {
        console.error('Error loading quiz:', error);
        quizTitle.textContent = 'Error loading quiz.';
        showMessage(error.message, 'error');
    }

    // --- Handle Quiz Submission ---
    quizForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const answers = [];
        const questionBlocks = document.querySelectorAll('.question-block');
        
        questionBlocks.forEach(block => {
            const questionId = parseInt(block.getAttribute('data-question-id'));
            const selectedOption = block.querySelector(`input[name="question-${questionId}"]:checked`);
            
            answers.push({
                questionId: questionId,
                answerIndex: selectedOption ? parseInt(selectedOption.value) : null // Store null if unanswered
            });
        });
        
        // Check if all questions are answered
        if (answers.some(a => a.answerIndex === null)) {
            showMessage('Please answer all questions before submitting.', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/submit/${quizId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ answers })
            });
            
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'Failed to submit quiz.');
            }
            
            // Show results modal
            document.getElementById('score-achieved').textContent = result.score;
            document.getElementById('score-total').textContent = result.total;
            document.getElementById('results-modal').classList.remove('hidden');
            
            // Clear the quiz ID so it can't be re-taken immediately
            localStorage.removeItem('currentQuizId');

        } catch (error) {
            console.error('Error submitting quiz:', error);
            showMessage(error.message, 'error');
        }
    });
});

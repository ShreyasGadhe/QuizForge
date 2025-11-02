// Utility to show messages
const showMessage = (message, type = 'error') => {
    const messageBox = document.getElementById('message-box');
    messageBox.textContent = message;
    messageBox.className = type;
    messageBox.classList.add('show');

    setTimeout(() => {
        messageBox.classList.remove('show');
    }, 3000);
};

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    const quizId = localStorage.getItem('currentQuizId');

    if (!token || !user || user.role !== 'student') {
        localStorage.clear();
        window.location.href = '/login.html';
        return;
    }
    
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
            questionElement.className = 'question-block bg-dark-tertiary border border-gray-700 rounded-xl p-6 hover:border-emerald transition-all duration-300';
            questionElement.setAttribute('data-question-id', q.id);

            // Generate options HTML
            const optionsHTML = q.options.map((opt, optIndex) => `
                <label for="q${q.id}-opt${optIndex}" 
                       class="flex items-center p-4 border border-gray-700 rounded-lg cursor-pointer hover:bg-dark-secondary hover:border-emerald transition-all duration-300 group">
                    <input type="radio" id="q${q.id}-opt${optIndex}" name="question-${q.id}" value="${optIndex}" 
                           class="w-5 h-5 text-emerald border-gray-600 focus:ring-emerald focus:ring-offset-dark-tertiary">
                    <span class="ml-4 text-gray-300 group-hover:text-white transition">${opt.text}</span>
                </label>
            `).join('');

            questionElement.innerHTML = `
                <div class="flex items-start mb-4">
                    <div class="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-emerald/20 to-emerald-dark/20 rounded-lg flex items-center justify-center mr-3 border border-emerald/30">
                        <span class="text-emerald font-bold text-sm">${index + 1}</span>
                    </div>
                    <p class="text-lg font-semibold text-white flex-1 pt-0.5">
                        ${q.question_text}
                    </p>
                </div>
                <div class="space-y-3 ml-11">
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
                answerIndex: selectedOption ? parseInt(selectedOption.value) : null
            });
        });
        
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
            
            localStorage.removeItem('currentQuizId');

        } catch (error) {
            console.error('Error submitting quiz:', error);
            showMessage(error.message, 'error');
        }
    });
});
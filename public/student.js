// Utility to show messages
const showMessage = (message, type = 'error') => {
    const messageBox = document.getElementById('message-box');
    if (!messageBox) {
        console.log(message);
        return;
    }
    messageBox.textContent = message;
    messageBox.className = type;
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

    document.getElementById('welcome-user').textContent = `Welcome, ${user.username}!`;

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/login.html';
    });

    // --- Search functionality ---
    const searchInput = document.getElementById('search-input');
    let searchTimeout;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadQuizzes(e.target.value);
        }, 300); // Debounce search by 300ms
    });

    // --- Fetch and Display Quizzes ---
    async function loadQuizzes(searchTerm = '') {
        try {
            let url = '/api/quizzes';
            if (searchTerm) {
                url += `?search=${encodeURIComponent(searchTerm)}`;
            }

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch quizzes.');

            const quizzes = await response.json();
            const quizList = document.getElementById('quiz-list');
            const noQuizzes = document.getElementById('no-quizzes');

            if (quizzes.length === 0) {
                noQuizzes.classList.remove('hidden');
                noQuizzes.textContent = searchTerm 
                    ? `No quizzes found for "${searchTerm}"` 
                    : 'No quizzes available at the moment.';
                // Clear existing quizzes
                const existingQuizzes = quizList.querySelectorAll('.quiz-card');
                existingQuizzes.forEach(q => q.remove());
                return;
            }

            noQuizzes.classList.add('hidden');
            quizList.innerHTML = '';

            quizzes.forEach(quiz => {
                const quizElement = document.createElement('div');
                quizElement.className = 'quiz-card flex items-center justify-between p-4 bg-dark-tertiary border border-gray-700 rounded-lg hover:border-emerald transition-all duration-300 hover:shadow-lg hover:shadow-emerald/10';
                
                const date = new Date(quiz.created_at).toLocaleDateString();
                
                quizElement.innerHTML = `
                    <div class="flex items-center flex-1">
                        <div class="w-10 h-10 bg-gradient-to-br from-emerald/20 to-emerald-dark/20 rounded-lg flex items-center justify-center mr-3 border border-emerald/30">
                            <svg class="w-5 h-5 text-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                        </div>
                        <div>
                            <span class="font-medium text-gray-200 block">${quiz.title}</span>
                            <span class="text-xs text-gray-500">${date}</span>
                        </div>
                    </div>
                    <button data-id="${quiz.id}" 
                            class="take-quiz-btn bg-gradient-to-r from-emerald to-emerald-dark text-white px-5 py-2 rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-emerald/50 transition-all duration-300 hover:-translate-y-0.5 flex items-center">
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                        </svg>
                        Take Quiz
                    </button>
                `;
                quizList.appendChild(quizElement);
            });

            document.querySelectorAll('.take-quiz-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const quizId = e.target.closest('button').getAttribute('data-id');
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
            scoreList.innerHTML = '';

            scores.forEach(score => {
                const scoreElement = document.createElement('div');
                scoreElement.className = 'p-4 bg-dark-tertiary border border-gray-700 rounded-lg hover:border-emerald transition-all duration-300';
                
                const percentage = Math.round((score.score / score.total) * 100);
                const date = new Date(score.taken_at).toLocaleDateString();
                
                let scoreColor = 'text-red-500';
                let scoreBgColor = 'bg-red-500/10';
                let scoreBorder = 'border-red-500/30';
                
                if (percentage >= 70) {
                    scoreColor = 'text-emerald';
                    scoreBgColor = 'bg-emerald/10';
                    scoreBorder = 'border-emerald/30';
                } else if (percentage >= 50) {
                    scoreColor = 'text-yellow-500';
                    scoreBgColor = 'bg-yellow-500/10';
                    scoreBorder = 'border-yellow-500/30';
                }

                scoreElement.innerHTML = `
                    <div class="flex justify-between items-center mb-3">
                        <span class="font-medium text-gray-200 text-sm">${score.title}</span>
                        <div class="${scoreBgColor} ${scoreBorder} border px-3 py-1 rounded-lg">
                            <span class="font-bold text-lg ${scoreColor}">${percentage}%</span>
                        </div>
                    </div>
                    <div class="flex justify-between items-center text-xs text-gray-400">
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
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

// Check auth on page load
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user || user.role !== 'admin') {
        localStorage.clear();
        window.location.href = '/login.html';
        return;
    }

    document.getElementById('welcome-user').textContent = `Welcome, ${user.username}!`;

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/login.html';
    });

    // Tab switching
    const tabCreate = document.getElementById('tab-create');
    const tabManage = document.getElementById('tab-manage');
    const contentCreate = document.getElementById('content-create');
    const contentManage = document.getElementById('content-manage');

    tabCreate.addEventListener('click', () => {
        tabCreate.classList.add('text-emerald', 'border-b-2', 'border-emerald');
        tabCreate.classList.remove('text-gray-400');
        tabManage.classList.remove('text-emerald', 'border-b-2', 'border-emerald');
        tabManage.classList.add('text-gray-400');
        contentCreate.classList.remove('hidden');
        contentManage.classList.add('hidden');
    });

    tabManage.addEventListener('click', () => {
        tabManage.classList.add('text-emerald', 'border-b-2', 'border-emerald');
        tabManage.classList.remove('text-gray-400');
        tabCreate.classList.remove('text-emerald', 'border-b-2', 'border-emerald');
        tabCreate.classList.add('text-gray-400');
        contentManage.classList.remove('hidden');
        contentCreate.classList.add('hidden');
        loadQuizzes();
    });

    // Handle Quiz Creation
    const createQuizForm = document.getElementById('create-quiz-form');
    createQuizForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('quiz-title').value;
        const aiPrompt = document.getElementById('ai-prompt').value;

        try {
            const response = await fetch('/api/quizzes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title, aiPrompt })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to create quiz.');
            }

            showMessage('Quiz created successfully!', 'success');
            createQuizForm.reset();

        } catch (error) {
            console.error('Quiz creation error:', error);
            showMessage(error.message, 'error');
            if (error.message.includes('forbidden')) {
                localStorage.clear();
                window.location.href = '/login.html';
            }
        }
    });

    // Load all quizzes for management
    async function loadQuizzes() {
        const quizzesList = document.getElementById('quizzes-list');
        const loadingText = document.getElementById('loading-quizzes');
        
        try {
            const response = await fetch('/api/admin/quizzes', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch quizzes.');
            }

            const quizzes = await response.json();
            
            if (loadingText) loadingText.remove();
            quizzesList.innerHTML = '';

            if (quizzes.length === 0) {
                quizzesList.innerHTML = '<p class="text-gray-500 text-center py-8">No quizzes created yet.</p>';
                return;
            }

            quizzes.forEach(quiz => {
                const quizCard = document.createElement('div');
                quizCard.className = 'bg-dark-tertiary border border-gray-700 rounded-xl p-6 hover:border-emerald transition';
                
                const date = new Date(quiz.created_at).toLocaleDateString();
                
                quizCard.innerHTML = `
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex-1">
                            <h3 class="text-xl font-bold text-white mb-2">${quiz.title}</h3>
                            <div class="flex flex-wrap gap-4 text-sm text-gray-400">
                                <span class="flex items-center">
                                    <svg class="w-4 h-4 mr-1 text-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                    ${quiz.question_count} questions
                                </span>
                                <span class="flex items-center">
                                    <svg class="w-4 h-4 mr-1 text-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                                    </svg>
                                    ${quiz.attempt_count} attempts
                                </span>
                                <span class="flex items-center">
                                    <svg class="w-4 h-4 mr-1 text-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                    </svg>
                                    ${date}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="viewAttempts(${quiz.id}, '${quiz.title.replace(/'/g, "\\'")}', ${quiz.attempt_count})" 
                                class="flex-1 bg-emerald/10 border border-emerald/30 text-emerald px-4 py-2 rounded-lg font-medium hover:bg-emerald/20 transition flex items-center justify-center">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                            </svg>
                            View Attempts
                        </button>
                        <button onclick="deleteQuiz(${quiz.id}, '${quiz.title.replace(/'/g, "\\'")}', ${quiz.attempt_count})" 
                                class="bg-red-600/10 border border-red-600/30 text-red-500 px-4 py-2 rounded-lg font-medium hover:bg-red-600/20 transition flex items-center justify-center">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                            Delete
                        </button>
                    </div>
                `;
                
                quizzesList.appendChild(quizCard);
            });

        } catch (error) {
            console.error('Error loading quizzes:', error);
            showMessage(error.message, 'error');
        }
    }

    // View attempts for a quiz
    window.viewAttempts = async function(quizId, quizTitle, attemptCount) {
        if (attemptCount === 0) {
            showMessage('No attempts yet for this quiz.', 'error');
            return;
        }

        const modal = document.getElementById('attempts-modal');
        const modalTitle = document.getElementById('modal-quiz-title');
        const attemptsList = document.getElementById('attempts-list');
        
        modalTitle.textContent = quizTitle;
        attemptsList.innerHTML = '<p class="text-gray-500 text-center py-8">Loading attempts...</p>';
        modal.classList.remove('hidden');

        try {
            const response = await fetch(`/api/admin/quizzes/${quizId}/attempts`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch attempts.');
            }

            const attempts = await response.json();
            attemptsList.innerHTML = '';

            if (attempts.length === 0) {
                attemptsList.innerHTML = '<p class="text-gray-500 text-center py-8">No attempts found.</p>';
                return;
            }

            attempts.forEach(attempt => {
                const attemptCard = document.createElement('div');
                const date = new Date(attempt.taken_at).toLocaleString();
                const percentage = attempt.percentage;
                
                let scoreColor = 'text-red-500';
                let scoreBg = 'bg-red-500/10';
                let scoreBorder = 'border-red-500/30';
                
                if (percentage >= 70) {
                    scoreColor = 'text-emerald';
                    scoreBg = 'bg-emerald/10';
                    scoreBorder = 'border-emerald/30';
                } else if (percentage >= 50) {
                    scoreColor = 'text-yellow-500';
                    scoreBg = 'bg-yellow-500/10';
                    scoreBorder = 'border-yellow-500/30';
                }

                attemptCard.className = 'bg-dark-tertiary border border-gray-700 rounded-lg p-4 hover:border-emerald transition';
                attemptCard.innerHTML = `
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-4">
                            <div class="w-12 h-12 bg-gradient-to-br from-emerald/20 to-emerald-dark/20 rounded-full flex items-center justify-center border border-emerald/30">
                                <svg class="w-6 h-6 text-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                </svg>
                            </div>
                            <div>
                                <p class="font-semibold text-white">${attempt.username}</p>
                                <p class="text-sm text-gray-400">${date}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="${scoreBg} ${scoreBorder} border px-4 py-2 rounded-lg">
                                <p class="text-2xl font-bold ${scoreColor}">${percentage}%</p>
                                <p class="text-xs text-gray-400">${attempt.score}/${attempt.total}</p>
                            </div>
                        </div>
                    </div>
                `;
                
                attemptsList.appendChild(attemptCard);
            });

        } catch (error) {
            console.error('Error loading attempts:', error);
            attemptsList.innerHTML = '<p class="text-red-500 text-center py-8">Error loading attempts.</p>';
        }
    };

    // Close modal
    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('attempts-modal').classList.add('hidden');
    });

    // Delete quiz
    window.deleteQuiz = async function(quizId, quizTitle, attemptCount) {
        const warningMsg = attemptCount > 0 
            ? `This quiz has ${attemptCount} attempts. Deleting it will remove all associated data.` 
            : 'Are you sure you want to delete this quiz?';
        
        if (!confirm(`Delete "${quizTitle}"?\n\n${warningMsg}`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/quizzes/${quizId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Failed to delete quiz.');
            }

            showMessage('Quiz deleted successfully!', 'success');
            loadQuizzes();

        } catch (error) {
            console.error('Error deleting quiz:', error);
            showMessage(error.message, 'error');
        }
    };
});
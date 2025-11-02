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

// Check auth on page load
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user || user.role !== 'admin') {
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
            createQuizForm.reset(); // Clear the form

        } catch (error) {
            console.error('Quiz creation error:', error);
            showMessage(error.message, 'error');
            if (error.message.includes('forbidden')) {
                localStorage.clear();
                window.location.href = '/login.html';
            }
        }
    });
});

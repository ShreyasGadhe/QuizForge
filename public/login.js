document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

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

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed.');
            }

            // Login successful
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Redirect based on role
            if (data.user.role === 'admin') {
                window.location.href = '/admin.html';
            } else if (data.user.role === 'student') {
                window.location.href = '/student.html';
            }

        } catch (error) {
            console.error('Login error:', error);
            showMessage(error.message, 'error');
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');

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

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const role = document.querySelector('input[name="role"]:checked').value;

        if (!username || !password) {
            showMessage('Please fill out all fields.', 'error');
            return;
        }

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password, role })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Registration failed.');
            }

            // Registration successful
            showMessage('Registration successful! Please login.', 'success');
            
            // Redirect to login page after a short delay
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);

        } catch (error) {
            console.error('Registration error:', error);
            showMessage(error.message, 'error');
        }
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const showLoginBtn = document.getElementById('showLogin');
    const showRegisterBtn = document.getElementById('showRegister');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const loginUsernameInput = document.getElementById('loginUsername');
    const loginPasswordInput = document.getElementById('loginPassword');
    const registerNameInput = document.getElementById('registerName');
    const registerUsernameInput = document.getElementById('registerUsername');
    const registerPasswordInput = document.getElementById('registerPassword');
    const registerEmailInput = document.getElementById('registerEmail');
    const messageDiv = document.getElementById('message');
    const toggleLoginPassword = document.getElementById('toggleLoginPassword');
    const toggleRegisterPassword = document.getElementById('toggleRegisterPassword');

    function showLoginForm() {
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
        messageDiv.textContent = '';
    }

    function showRegisterForm() {
        loginForm.classList.remove('active');
        registerForm.classList.add('active');
        messageDiv.textContent = '';
    }

    function togglePasswordVisibility(inputField, toggleIcon) {
        if (inputField.type === 'password') {
            inputField.type = 'text';
            toggleIcon.src = 'images/eye-closed.png';
            toggleIcon.alt = 'Hide Password';
        } else {
            inputField.type = 'password';
            toggleIcon.src = 'images/eye-open.png';
            toggleIcon.alt = 'Show Password';
        }
    }

    async function handleLogin(username, password) {
        try {
            const response = await fetch('http://localhost:5000/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            if (data.token) {
                const tokenExpiration = Date.now() + 3 * 30 * 24 * 60 * 60 * 1000;

                if (chrome?.storage?.local) {
                    await new Promise((resolve, reject) => {
                        chrome.storage.local.set(
                            {
                                token: data.token,
                                user_id: data.user_id,
                                tokenExpiration: tokenExpiration
                            },
                            () => {
                                if (chrome.runtime.lastError) {
                                    reject(chrome.runtime.lastError);
                                } else {
                                    resolve();
                                }
                            }
                        );
                    });
                } else {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user_id', data.user_id);
                    localStorage.setItem('tokenExpiration', tokenExpiration.toString());
                }

                messageDiv.textContent = 'Login successful!';
                messageDiv.style.color = 'green';
                setTimeout(() => {
                    window.location.href = 'popup.html';
                }, 500);
            }
        } catch (error) {
            console.error('Login Error:', error);
            messageDiv.textContent = error.message || 'Login failed';
            messageDiv.style.color = 'red';
        }
    }

    async function handleRegister(name, username, password, email) {
        try {
            if (password.length < 8) {
                messageDiv.textContent = 'Password must be at least 8 characters long';
                messageDiv.style.color = 'red';
                return;
            }

            const response = await fetch('http://localhost:5000/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, username, password, email }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }

            if (data.message === 'User registered successfully') {
                messageDiv.textContent = 'Registration successful! Please login.';
                messageDiv.style.color = 'green';
                setTimeout(showLoginForm, 1000);
            }
        } catch (error) {
            console.error('Registration Error:', error);
            messageDiv.textContent = error.message || 'Registration failed';
            messageDiv.style.color = 'red';
        }
    }

    showLoginBtn.addEventListener('click', showLoginForm);
    showRegisterBtn.addEventListener('click', showRegisterForm);

    toggleLoginPassword.addEventListener('click', () => {
        togglePasswordVisibility(loginPasswordInput, toggleLoginPassword);
    });

    toggleRegisterPassword.addEventListener('click', () => {
        togglePasswordVisibility(registerPasswordInput, toggleRegisterPassword);
    });

    loginBtn.addEventListener('click', async () => {
        const username = loginUsernameInput.value.trim();
        const password = loginPasswordInput.value;

        if (!username || !password) {
            messageDiv.textContent = 'Please enter both username and password';
            messageDiv.style.color = 'red';
            return;
        }

        await handleLogin(username, password);
    });

    registerBtn.addEventListener('click', async () => {
        const name = registerNameInput.value.trim();
        const username = registerUsernameInput.value.trim();
        const password = registerPasswordInput.value;
        const email = registerEmailInput.value.trim();

        if (!name || !username || !password || !email) {
            messageDiv.textContent = 'All fields are required';
            messageDiv.style.color = 'red';
            return;
        }

        await handleRegister(name, username, password, email);
    });
});
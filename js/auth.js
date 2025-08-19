// API configuration
const API_BASE = '/api';

// DOM elements
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

// Check if user is already logged in
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const token = localStorage.getItem('authToken');
        const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
        
        // If we have a valid token, redirect to the app
        if (token && user) {
            window.location.href = 'index.html';
        }
    } catch (error) {
        // Auth check failed - user will see login form
    }
});

// Handle login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(API_BASE + '/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
            throw new Error('Invalid credentials');
        }
        
        const data = await response.json();
        
        // Store auth data
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        // Redirect to main app if login successful
        window.location.href = 'index.html';
    } catch (error) {
        loginError.textContent = 'Invalid email or password';
        loginError.style.display = 'block';
    }
});
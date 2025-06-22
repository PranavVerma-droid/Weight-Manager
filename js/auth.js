// Initialize PocketBase client
const pb = new PocketBase("https://pb-1.pranavv.co.in");

// DOM elements
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const googleLoginBtn = document.getElementById('google-login-btn');

// Check if user is already logged in
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // If we have a valid token in local storage, redirect to the app
        if (pb.authStore.isValid) {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Auth check error:', error);
    }
});

// Handle login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        // Authenticate user
        await pb.collection('users').authWithPassword(email, password);
        
        // Redirect to main app if login successful
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = 'Invalid email or password';
        loginError.style.display = 'block';
    }
});

// Handle Google OAuth login
googleLoginBtn.addEventListener('click', async () => {
    try {
        // Clear any existing error messages
        loginError.style.display = 'none';
        
        // Start OAuth flow with Google
        const authData = await pb.collection('users').authWithOAuth2('google');
        
        // Redirect to main app if login successful
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Google login error:', error);
        loginError.textContent = 'Google login failed. Please try again.';
        loginError.style.display = 'block';
    }
});

// Signup functionality removed
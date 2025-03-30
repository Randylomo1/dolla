import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [credentials, setCredentials] = useState({ 
    username: '', 
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors = {};
    if (!credentials.username.trim()) {
      newErrors.username = 'Username required';
    }
    if (!credentials.password) {
      newErrors.password = 'Password required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const endpoint = isSignUp 
        ? 'http://localhost:8000/api/auth/signup/'
        : 'http://localhost:8000/api/auth/login/';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(credentials)
      });

      if (response.ok) {
        const { token, deriv_credentials } = await response.json();
        localStorage.setItem('authToken', token);
        localStorage.setItem('deriv_credentials', JSON.stringify(deriv_credentials));
        navigate('/dashboard', {
          state: { deriv_credentials }
        });
      } else {
        const data = await response.json();
        setErrors({ general: data.message || 'Authentication failed' });
      }
    } catch (error) {
      setErrors({ general: 'Network error - please try again' });
    }
  };

  return (
    <div className="login-container">
      <button 
        className="auth-toggle"
        onClick={() => setIsSignUp(!isSignUp)}
      >
        {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign Up'}
      </button>
      <form onSubmit={handleSubmit}>
        <h2>Trading Platform Login</h2>
        {errors.general && <div className="error">{errors.general}</div>}
        
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            value={credentials.username}
            onChange={(e) => setCredentials({...credentials, username: e.target.value})}
            className={errors.username ? 'error' : ''}
          />
          {errors.username && <span className="error-message">{errors.username}</span>}
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={credentials.email}
            onChange={(e) => setCredentials({...credentials, email: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={credentials.password}
            onChange={(e) => setCredentials({...credentials, password: e.target.value})}
            className={errors.password ? 'error' : ''}
          />
          {errors.password && <span className="error-message">{errors.password}</span>}
        </div>

        <button type="submit" className="login-button">Sign In</button>
      </form>
    </div>
  );
}
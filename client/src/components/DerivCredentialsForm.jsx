import { useState } from 'react';
import { initWebSocket } from '../services/websocketService';

export const DerivCredentialsForm = ({ onConnect }) => {
  const [appId, setAppId] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!appId || !token) {
      setError('Both App ID and Token are required');
      return;
    }

    localStorage.setItem('deriv_credentials', JSON.stringify({
      app_id: appId,
      token: token
    }));

    const { disconnect } = initWebSocket(
      (msg) => console.log('WS message:', msg),
      (status) => {
        if (status === 'connected') onConnect();
      }
    );

    return () => disconnect();
  };

  return (
    <form onSubmit={handleSubmit} className="credentials-form">
      <h3>Deriv API Credentials</h3>
      {error && <div className="error">{error}</div>}
      
      <label>
        App ID:
        <input
          type="text"
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
          placeholder="Enter your Deriv App ID"
        />
      </label>

      <label>
        Auth Token:
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Enter your Deriv Token"
        />
      </label>

      <button type="submit">Connect</button>
    </form>
  );
};
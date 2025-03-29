import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import PerformanceDashboard from './components/PerformanceDashboard';
import { initWebSocket, subscribeToChannel } from './services/websocketService';
import { Chart, registerables } from 'chart.js';
import { Line } from 'react-chartjs-2';
import './App.css';

Chart.register(...registerables);

function AppHeader() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if(searchParams.get('auth_error')) {
      alert('Authentication failed: ' + searchParams.get('auth_error'));
      navigate('/');
    }
  }, [location]);

  const handleLogin = () => {
    window.location.href = `https://oauth.deriv.com/oauth2/authorize?app_id=${encodeURIComponent(process.env.DERIV_APP_ID)}&redirect_uri=${encodeURIComponent(window.location.origin + '/dashboard')}`;
  };

  return (
    <div className="app-container">
      <nav className="app-nav">
        <Link to="/" className="nav-brand">HFT Dashboard</Link>
        <div className="nav-links">
          <Link to="/dashboard" className="nav-link">Trading Interface</Link>
          <button onClick={handleLogin} className="login-button">
            {isAuthenticated ? 'Account' : 'Connect to Deriv'}
          </button>
        </div>
      </nav>

      <div className="auth-status">
        {location.search.includes('auth_success=true') && (
          <div className="auth-success">Authentication successful!</div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [marketData, setMarketData] = useState([]);
  const [agentStatus, setAgentStatus] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [{
      label: 'Price Movement',
      data: [],
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.1
    }]
  });

  useEffect(() => {
    const socket = initWebSocket(
      (message) => {
        switch(message.type) {
          case 'MARKET_DATA':
            const newData = [...marketData.slice(-99), message.payload];
            setMarketData(newData);
            setChartData({
              labels: newData.map((_, i) => i),
              datasets: [{
                ...chartData.datasets[0],
                data: newData.map(d => d.price)
              }]
            });
            break;
          case 'AGENT_STATUS':
            setAgentStatus(prev => [...prev, message.payload]);
            break;
          case 'TRADE_SIGNAL':
            handleTradeSignal(message.payload);
            break;
        }
      },
      setConnectionStatus
    );

    subscribeToChannel('market-data');
    subscribeToChannel('agent-status');

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch(msg.type) {
        case 'MARKET_DATA':
          setMarketData(prev => [...prev.slice(-99), msg.payload]);
          break;
        case 'AGENT_STATUS':
          setAgentStatus(msg.payload);
          break;
        case 'TRADE_SIGNAL':
          handleTradeSignal(msg.payload);
          break;
      }
    };

    ws.onclose = () => {
      setTimeout(() => window.location.reload(), 1000);
    };

    setWsInstance(ws);
    return () => ws.close();
  }, []);
  const [count, setCount] = useState(0)

  return (
    <div className="trading-dashboard">
      <h1>HFT Platform</h1>
      <PerformanceDashboard />
      <div className="status-bar">
        Connection Status: <span className={connectionStatus}>{connectionStatus}</span>
      </div>
      
      <div className="main-grid">
        <div className="chart-container">
          <Line data={chartData} options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: false
          }} />
        </div>
        
        <div className="agents-panel">
          <h3>Active Agents</h3>
          <div className="agent-list">
            {agentStatus.map((agent, i) => (
              <div key={i} className="agent-card">
                <div className="agent-header">
                  <span className="strategy">{agent.strategy}</span>
                  <span className={`status ${agent.status}`}>{agent.status}</span>
                </div>
                <div className="metrics">
                  <div>ROI: {agent.roi}%</div>
                  <div>Trades: {agent.tradeCount}</div>
                  <div>Latency: {agent.latency}ms</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="execution-controls">
          <h3>Trade Execution</h3>
          <button className="emergency-stop">⛔ Emergency Stop</button>
          <div className="risk-parameters">
            <input type="number" placeholder="Max Drawdown %" />
            <input type="number" placeholder="Daily Loss Limit" />
            <button className="update-risk">Update Parameters</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App

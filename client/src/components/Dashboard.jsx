import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { WebSocketService } from '../services/websocket';

export default function Dashboard() {
  const [marketData, setMarketData] = useState(null);
  const [agents, setAgents] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if(searchParams.get('auth_error')) {
      navigate('/?error=authentication_failed');
    }
    
    const ws = new WebSocketService();
    ws.connect('wss://localhost:3000');

    ws.on('MARKET_DATA', data => {
      setMarketData(prev => ({
        ...prev,
        [data.symbol]: data.quote
      }));
    });

    ws.on('AGENT_STATUS', agents => {
      setAgents(agents);
    });

    return () => ws.disconnect();
  }, []);

  return (
    <div className="dashboard-container">
      <div className="market-data-panel">
        {marketData && Object.entries(marketData).map(([symbol, quote]) => (
          <div key={symbol} className="market-card">
            <h3>{symbol}</h3>
            <p>Bid: {quote.bid}</p>
            <p>Ask: {quote.ask}</p>
          </div>
        ))}
      </div>
      
      <div className="agent-status-panel">
        <h2>Active Trading Agents</h2>
        {agents.map(agent => (
          <div key={agent.id} className="agent-card">
            <p>Strategy: {agent.strategy}</p>
            <p>Profit: ${agent.stats.profit.toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
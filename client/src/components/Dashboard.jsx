import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { initWebSocket } from '../services/websocketService';

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
    
    const socket = initWebSocket(
      (message) => {
        switch(message.type) {
          case 'MARKET_DATA':
            setMarketData(prev => ({
              ...prev,
              [message.payload.symbol]: message.payload.quote
            }));
            break;
          case 'AGENT_STATUS':
            setAgents(message.payload);
            break;
        }
      },
      (status) => console.log('Connection status:', status)
    );

    return () => {
      if(socket) socket.disconnect();
    };
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
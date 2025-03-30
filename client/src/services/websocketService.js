export const initWebSocket = (messageHandler, statusHandler) => {
  const authToken = localStorage.getItem('authToken');
  const derivCredentials = JSON.parse(localStorage.getItem('deriv_credentials') || '{}');

  const ws = new WebSocket(
    `${import.meta.env.VITE_WS_URL}?token=${encodeURIComponent(authToken)}`,
    {
      headers: {
        'Deriv-App-ID': import.meta.env.VITE_DERIV_APP_ID,
        'Deriv-Auth-Token': derivCredentials?.token || ''
      }
    }
  );
  const socket = new WebSocket(`wss://${window.location.host}/ws/deriv`);
  
  socket.onopen = () => {
    socket.send(JSON.stringify({
      type: 'AUTH',
      payload: derivCredentials
    }));
    statusHandler('connected');
  };
  
  socket.on('MARKET_DATA', (data) => {
    onMessage({ type: 'MARKET_DATA', payload: data });
  });
  
  socket.on('AGENT_STATUS', (data) => {
    onMessage({ type: 'AGENT_STATUS', payload: data });
  });
  
  socket.on('TRADE_SIGNAL', (data) => {
    onMessage({ type: 'TRADE_SIGNAL', payload: data });
  });
  
  socket.on('disconnect', () => {
    console.log('WebSocket connection lost');
    onStatusUpdate('disconnected');
  });
  
  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
    onStatusUpdate('error');
  });
  
  return {
    disconnect: () => socket.close()
  };
};
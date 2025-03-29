import { io } from 'socket.io-client';

const SOCKET_URL = 'ws://localhost:3000';

let socket = null;

const initWebSocket = (onMessage, onStatusUpdate) => {
  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    auth: {
      token: localStorage.getItem('jwt')
    }
  });

  socket.on('connect', () => {
    console.log('WebSocket connection established');
    onStatusUpdate('connected');
  });

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

  return socket;
};

const subscribeToChannel = (channel) => {
  if (socket) {
    socket.emit('subscribe', channel);
  }
};

const unsubscribeFromChannel = (channel) => {
  if (socket) {
    socket.emit('unsubscribe', channel);
  }
};

export { initWebSocket, subscribeToChannel, unsubscribeFromChannel };
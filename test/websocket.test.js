const WebSocket = require('ws');
const { initWebSocket } = require('../client/src/services/websocketService');

jest.mock('ws');

describe('WebSocket Integration Tests', () => {
  let mockSocket;
  const mockMessageHandler = jest.fn();
  const mockStatusHandler = jest.fn();

  beforeEach(() => {
    mockSocket = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn()
    };
    WebSocket.mockImplementation(() => mockSocket);
  });

  test('should establish connection and send auth', () => {
    initWebSocket({ token: 'test' }, mockMessageHandler, mockStatusHandler);
    
    expect(WebSocket).toHaveBeenCalledWith('wss://localhost/ws/deriv');
    expect(mockSocket.on).toHaveBeenCalledWith('open', expect.any(Function));
    
    // Trigger open event
    mockSocket.on.mock.calls.find(call => call[0] === 'open')[1]();
    expect(mockSocket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'AUTH', payload: { token: 'test' } })
    );
    expect(mockStatusHandler).toHaveBeenCalledWith('connected');
  });

  test('should handle market data messages', () => {
    const service = initWebSocket({}, mockMessageHandler, mockStatusHandler);
    
    // Simulate message event
    const testData = { type: 'MARKET_DATA', payload: { price: 1.2345 } };
    mockSocket.on.mock.calls.find(call => call[0] === 'message')[1](
      JSON.stringify(testData)
    );
    
    expect(mockMessageHandler).toHaveBeenCalledWith(testData);
  });

  test('should handle connection errors', () => {
    initWebSocket({}, mockMessageHandler, mockStatusHandler);
    
    // Trigger error event
    const testError = new Error('Connection failed');
    mockSocket.on.mock.calls.find(call => call[0] === 'error')[1](testError);
    
    expect(mockStatusHandler).toHaveBeenCalledWith('error');
    expect(console.error).toHaveBeenCalledWith('WebSocket error:', testError);
  });
});
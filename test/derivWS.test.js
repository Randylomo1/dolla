const DerivWS = require('../lib/derivWS');
const Redis = require('redis');
const { WebSocket } = require('ws');

jest.mock('ws');
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    publish: jest.fn(),
    on: jest.fn()
  }))
}));

describe('DerivWS Redis Operations', () => {
  let deriv;

  beforeEach(() => {
    jest.clearAllMocks();
    deriv = new DerivWS();
  });

  test('should publish trade errors to Redis', async () => {
    const testError = { code: 'InvalidRequest', message: 'Test error' };
    deriv.handleMessage({ error: testError });
    
    expect(Redis.createClient().publish).toHaveBeenCalledWith(
      'trade-errors',
      JSON.stringify({
        code: testError.code,
        message: testError.message,
        timestamp: expect.any(Number)
      })
    );
  });

  test('should handle connection status updates', () => {
    deriv.connect();
    WebSocket.mock.instances[0].onopen();
    expect(WebSocket.mock.instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({ authorize: process.env.DERIV_TOKEN })
    );
  });

  test('should exponentially backoff reconnect attempts', () => {
    deriv.reconnectInterval = 1000;
    WebSocket.mock.instances[0].onclose();
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 1000);
    WebSocket.mock.instances[0].onclose();
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 2000);
  });
});
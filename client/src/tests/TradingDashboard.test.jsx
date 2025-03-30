import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';
import { initWebSocket } from '../services/websocketService';
import { jest } from '@jest/globals';

jest.mock('../services/websocketService');

describe('Trading Dashboard UI Tests', () => {
  beforeEach(() => {
    initWebSocket.mockImplementation((credentials, handler) => ({
      disconnect: jest.fn()
    }));
  });

  test('displays connection status correctly', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(screen.getByText(/Connection Status:/)).toBeInTheDocument();
    expect(screen.getByText('disconnected')).toHaveClass('disconnected');
  });

  test('updates chart with market data', async () => {
    const { container } = render(<App />);
    
    // Simulate market data update
    const testData = { type: 'MARKET_DATA', payload: { price: 1.2345 } };
    const messageHandler = initWebSocket.mock.calls[0][1];
    messageHandler(testData);

    const chart = container.querySelector('.chart-container canvas');
    expect(chart).toBeInTheDocument();
  });

  test('displays agent status updates', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    
    // Simulate agent status update
    const testStatus = { 
      strategy: 'Arbitrage',
      status: 'active',
      roi: 2.5,
      tradeCount: 15,
      latency: 42
    };
    const messageHandler = initWebSocket.mock.calls[0][1];
    messageHandler({ type: 'AGENT_STATUS', payload: testStatus });

    expect(screen.getByText('Arbitrage')).toBeInTheDocument();
    expect(screen.getByText('active')).toHaveClass('active');
    expect(screen.getByText(/ROI: 2.5%/)).toBeInTheDocument();
  });

  test('handles emergency stop click', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    const stopButton = screen.getByText('⛔ Emergency Stop');
    fireEvent.click(stopButton);
    expect(stopButton).toBeDisabled();
  });
});
import React, { useEffect, useState } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export default function PerformanceDashboard() {
  const [metrics, setMetrics] = useState({
    throughput: 0,
    latencyStats: { p50: 0, p90: 0, p99: 0 },
    profitability: { daily: 0, weekly: 0 }
  });

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3000`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'PERFORMANCE_METRICS') {
        setMetrics(prev => ({
          throughput: data.throughput,
          latencyStats: data.latencyStats,
          profitability: data.profitability
        }));
      }
    };

    return () => ws.close();
  }, []);

  const latencyData = {
    labels: ['p50', 'p90', 'p99'],
    datasets: [{
      label: 'Execution Latency (μs)',
      data: [metrics.latencyStats.p50, metrics.latencyStats.p90, metrics.latencyStats.p99],
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      borderColor: 'rgba(54, 162, 235, 1)'
    }]
  };

  const throughputData = {
    labels: Array.from({ length: 60 }, (_, i) => i),
    datasets: [{
      label: 'Trades/sec',
      data: Array(60).fill(0).concat(metrics.throughput),
      borderColor: 'rgba(75, 192, 192, 1)',
      tension: 0.1
    }]
  };

  return (
    <div style={dashboardStyle}>
      <div style={gridStyle}>
        <div style={metricCardStyle}>
          <h3>Throughput</h3>
          <p>{metrics.throughput} trades/sec</p>
        </div>
        <div style={metricCardStyle}>
          <h3>Latency (p99)</h3>
          <p>{metrics.latencyStats.p99}μs</p>
        </div>
        <div style={metricCardStyle}>
          <h3>Daily Profit</h3>
          <p>${metrics.profitability.daily.toFixed(2)}</p>
        </div>
      </div>
      
      <div style={chartContainer}>
        <div style={chartStyle}>
          <Line data={throughputData} options={chartOptions('Throughput History')} />
        </div>
        <div style={chartStyle}>
          <Bar data={latencyData} options={chartOptions('Latency Distribution')} />
        </div>
        <div style={chartStyle}>
          <Line data={{
            labels: metrics.historicalLatency.map((_, i) => i),
            datasets: [{
              label: 'Historical Latency (p99)',
              data: metrics.historicalLatency,
              borderColor: 'rgba(255, 99, 132, 1)',
              tension: 0.1
            }]
          }} options={chartOptions('Latency Trend')} />
        </div>
      </div>
    </div>
  );
}

const dashboardStyle = {
  padding: '20px',
  backgroundColor: '#f5f5f5',
  minHeight: '100vh'
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '20px',
  marginBottom: '20px'
};

const metricCardStyle = {
  backgroundColor: 'white',
  padding: '15px',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
};

const chartContainer = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '20px'
};

const chartStyle = {
  backgroundColor: 'white',
  padding: '15px',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
};

const chartOptions = (title) => ({
  responsive: true,
  plugins: {
    title: {
      display: true,
      text: title
    }
  },
  animation: false,
  scales: {
    y: {
      beginAtZero: true
    }
  }
});
const Redis = require('redis');
const { REDIS_URL } = process.env;
const { performance } = require('node:perf_hooks');

class TradingMetrics {
  constructor() {
    this.redis = Redis.createClient({ 
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (attempts) => Math.min(attempts * 100, 5000)
      }
    });
    
    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
      this.metrics.errors += 5; // Penalize error rate
    });

    this.redis.on('reconnecting', () => {
      console.log('Attempting Redis reconnection...');
      this.metrics.systemLoad = Math.min(this.metrics.systemLoad + 10, 100);
    });

    this.metrics = {
      tradesExecuted: 0,
      executionLatency: [],
      systemLoad: 0,
      errors: 0,
      ordersSplit: 0,
      childOrdersCreated: 0,
      marketImpactScores: [],
      smallTradeProfit: 0,
      arbitrageOpportunities: 0,
      arbitrageProfit: 0
    };

    this.connectionRetries = 0;
    this.circuitState = 'CLOSED';
  }

  async start() {
    await this.redis.connect();
    setInterval(() => this.updateMetrics(), 5000);
    this.redis.subscriber = this.redis.duplicate();
    await this.redis.subscriber.connect();
    
    this.redis.subscriber.subscribe('trade-executions', (msg) => {
      try {
        const trade = JSON.parse(msg);
        
        if (!trade?.id || !trade?.timestamp) {
          console.error('Invalid trade message:', msg);
          this.metrics.errors++;
          return;
        }

        this.metrics.tradesExecuted++;
        const startTime = performance.now();
// ... existing trade processing code ...
this.metrics.executionLatency.push(performance.now() - startTime);
    }).catch(err => {
      console.error('Trade processing error:', err);
      this.metrics.errors++;
    });

    this.redis.subscriber.subscribe('trade-errors', () => {
      this.metrics.errors++;
    });
  }

  async updateMetrics() {
    try {
      if(this.circuitState === 'OPEN') {
        console.warn('Circuit breaker open - skipping metric update');
        return;
      }

      const latencyStats = this.calculateLatencyPercentiles();
      const pipeline = this.redis.pipeline();
      
      const metricValues = this.validateMetricValues({
        trades_per_sec: (this.metrics.tradesExecuted / 5).toFixed(2),
        avg_latency: latencyStats.avg.toFixed(3),
        latency_p95: latencyStats.p95.toFixed(3),
        latency_p99: latencyStats.p99.toFixed(3),
        system_load: this.metrics.systemLoad,
        error_rate: (this.metrics.errors / (this.metrics.tradesExecuted || 1)).toFixed(4),
        orders_split: this.metrics.ordersSplit,
        child_orders: this.metrics.childOrdersCreated,
        avg_impact: this.metrics.marketImpactScores.length 
          ? (this.metrics.marketImpactScores.reduce((a, b) => a + b, 0) / this.metrics.marketImpactScores.length).toFixed(4)
          : 0,
        small_trade_profit: this.metrics.smallTradeProfit.toFixed(4),
        arbitrage_opportunities: this.metrics.arbitrageOpportunities,
        arbitrage_profit: this.metrics.arbitrageProfit.toFixed(4)
      });

      pipeline.hSet('system:metrics', metricValues);
      await pipeline.exec();

      const resetPipeline = this.redis.pipeline();
      resetPipeline.hSet('system:metrics', {
        trades_per_sec: '0',
        avg_latency: '0',
        latency_p95: '0',
        latency_p99: '0',
        error_rate: '0'
      });
      await resetPipeline.exec();

      this.metrics.tradesExecuted = 0;
      this.metrics.errors = 0;
      this.metrics.executionLatency = [];
      this.metrics.smallTradeProfit = 0;
      this.metrics.arbitrageOpportunities = 0;
      this.metrics.arbitrageProfit = 0;
      this.connectionRetries = 0; // Reset retries on success
    } catch (err) {
      console.error('Metric update failed:', err);
      this.metrics.errors += 3;
      this.connectionRetries++;

      if(this.connectionRetries > 5) {
        this.circuitState = 'OPEN';
        setTimeout(() => {
          this.circuitState = 'HALF_OPEN';
          console.log('Circuit moving to HALF_OPEN state');
        }, 30000);
      }
    }
  }

  validateMetricValues(metrics) {
    const validated = {};
    for(const [key, value] of Object.entries(metrics)) {
      const numValue = parseFloat(value);
      if(!isNaN(numValue) && numValue >= 0 && numValue <= 1000) {
        validated[key] = numValue.toFixed(4);
      } else {
        console.warn(`Invalid metric value for ${key}: ${value}`);
        validated[key] = '0';
      }
    }
    return validated;
  }

  calculateLatencyPercentiles() {
    const sorted = [...this.metrics.executionLatency].sort((a, b) => a - b);
    return {
      avg: sorted.length ? (sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2) : 0,
      p95: sorted.length ? sorted[Math.floor(sorted.length * 0.95)].toFixed(2) : 0,
      p99: sorted.length ? sorted[Math.floor(sorted.length * 0.99)].toFixed(2) : 0
    };
  }

  async getPrometheusMetrics() {
    const metrics = await this.redis.hGetAll('system:metrics');
    return `# HELP trades_per_second Trades executed per second
# TYPE trades_per_second gauge
trades_per_second ${metrics.trades_per_sec}

# HELP execution_latency_ms Trade execution latency metrics
# TYPE execution_latency_ms gauge
execution_latency_ms_avg ${metrics.avg_latency}
execution_latency_ms_p95 ${metrics.latency_p95}
execution_latency_ms_p99 ${metrics.latency_p99}

# HELP system_load Current system load percentage
# TYPE system_load gauge
system_load ${metrics.system_load}

# HELP error_rate Trade error rate percentage
# TYPE error_rate gauge
error_rate ${metrics.error_rate}
`;
  }
}

module.exports = new TradingMetrics();
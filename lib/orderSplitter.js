const Redis = require('redis');
const { METRICS_CHANNEL, MARKET_DATA_CHANNEL } = process.env;
const metrics = require('./metrics');

class OrderSplitter {
 constructor() {
 this.redis = Redis.createClient({ url: process.env.REDIS_URL });
 this.strategies = {
 TWAP: this.twapSplit,
 VWAP: this.vwapSplit
 };
 }

 async start() {
 await this.redis.connect();
 this.redis.subscribe('large-orders', (message) => {
 const order = JSON.parse(message);
 this.processOrder(order);
 });
 }

 processOrder(order) {
 try {
 const strategy = this.strategies[order.strategy];
 if (!strategy) throw new Error('Invalid strategy');

 const childOrders = strategy(order);
 this.trackMarketImpact(childOrders);
 this.publishOrders(childOrders);

 metrics.metrics.ordersSplit++;
 metrics.metrics.childOrdersCreated += childOrders.length;
 } catch (error) {
 metrics.metrics.errors++;
 }
 }

 twapSplit(order) {
 const interval = order.duration / order.quantity;
 return Array.from({ length: order.quantity }, (_, i) => ({
 ...order,
 quantity: 1,
 timestamp: Date.now() + i * interval
 }));
 }

 vwapSplit(order) {
 const marketData = this.getMarketVolumeProfile();
 const [dailyLimit, currentProfit] = await Promise.all([
    this.redis.hGet('risk:daily', 'daily_limit'),
    this.redis.hGet('risk:daily', 'current_profit')
  ]);
  
  const remainingCapital = dailyLimit - currentProfit;
  const allocated = remainingCapital * (1 - Math.exp(-0.15 * (Date.now() - riskState.lastProfitUpdate)/3600000/24));
  
  return marketData.map(level => ({
    ...order,
    quantity: Math.round((level.volume / totalVolume) * allocated * 0.1),
    price: level.price,
    validity: Math.min(30000, (24 - (Date.now() - riskState.lastProfitUpdate)/3600000) * 3600000)
  })).filter(o => o.quantity > 0);
 }

 trackMarketImpact(orders) {
 const impactScores = orders.map(order => 
 Math.log(order.quantity / this.getAverageTradeSize()) * 0.5
 );
 metrics.metrics.marketImpactScores.push(...impactScores);
 }

 async getMarketVolumeProfile() {
 return this.redis.json.get('market:volume-profile');
 }

 getAverageTradeSize() {
 return this.redis.get('metrics:avg_trade_size') || 100;
 }

 publishOrders(orders) {
 orders.forEach(order => {
 this.redis.publish('child-orders', JSON.stringify(order));
 });
 }
}

module.exports = new OrderSplitter();
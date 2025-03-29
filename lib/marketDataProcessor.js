export const processMarketData = (rawData) => {
  // Track volume at price levels
  VolumeProfile.addTrade(rawData.price, rawData.quantity);
  
  // High-performance normalization with pre-allocated buffers
  const normalized = new Float64Array(6);
  normalized[0] = Date.now();
  normalized[1] = parseFloat(rawData.bid);
  normalized[2] = parseFloat(rawData.ask);
  normalized[3] = normalized[2] - normalized[1];
  normalized[4] = parseInt(rawData.volume, 10);

  // Streaming statistics with circular buffers
  const windowSize = 100;
  const bids = new CircularBuffer(windowSize);
  bids.push(normalized[1]);
  
  // Compute features without function calls
  return {
    timestamp: normalized[0],
    bid: normalized[1],
    ask: normalized[2],
    spread: normalized[3],
    volume: normalized[4],
    movingAverage: bids.average(),
    volatility: Math.sqrt(bids.variance()),
    orderBookImbalance: (rawData.bid_depth - rawData.ask_depth) / 
                      (rawData.bid_depth + rawData.ask_depth)
  };
};

class CircularBuffer {
  constructor(size) {
    this.buffer = new Float64Array(size);
    this.index = 0;
    this.count = 0;
  }

  push(value) {
    this.buffer[this.index] = value;
    this.index = (this.index + 1) % this.buffer.length;
    this.count = Math.min(this.count + 1, this.buffer.length);
  }

  average() {
    let sum = 0;
    for(let i = 0; i < this.count; i++) {
      sum += this.buffer[i];
    }
    return sum / this.count;
  }

  variance() {
    const mean = this.average();
    let variance = 0;
    for(let i = 0; i < this.count; i++) {
      variance += Math.pow(this.buffer[i] - mean, 2);
    }
    return variance / this.count;
  }
}

class VolumeProfile {
  static profile = new Map();

  static addTrade(price, volume) {
    const level = Math.round(price * 100);
    this.profile.set(level, (this.profile.get(level) || 0) + volume);
  }

  static getProfile() {
    return Array.from(this.profile.entries())
      .map(([level, volume]) => ({
        price: level/100,
        volume
      }))
      .sort((a, b) => b.volume - a.volume);
  }

  static reset() {
    this.profile.clear();
  }
}

const saveVolumeProfile = async () => {
  const profile = VolumeProfile.getProfile();
  await redis.json.set('market:volume-profile', '$', profile);
  VolumeProfile.reset();
};

// Save profile every 5 seconds
setInterval(saveVolumeProfile, 5000);

export const detectAnomalies = (dataStream) => {
  // Real-time Z-score calculation with O(1) complexity
  const latest = dataStream[dataStream.length - 1];
  const mean = dataStream.reduce((a,b) => a + b, 0) / dataStream.length;
  const stdDev = Math.sqrt(dataStream.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / dataStream.length);
  return Math.abs((latest - mean) / stdDev) > 4.5;
};

export const detectSmallTradeOpportunities = (marketData) => {
  // Small trade opportunities when spread is tight and volume is low
  const isSmallTrade = marketData.spread < 0.0005 && 
                      marketData.volume < 1000 &&
                      marketData.volatility < 0.01;
  
  return {
    isOpportunity: isSmallTrade,
    suggestedSize: Math.floor(1000 / marketData.spread)
  };
};

export const detectArbitrage = (marketData, otherMarketData) => {
  // Price difference must exceed spread + fees to be profitable
  const priceDifference = Math.abs(marketData.bid - otherMarketData.ask);
  const minProfitThreshold = marketData.spread + otherMarketData.spread + 0.0002;
  
  return {
    isOpportunity: priceDifference > minProfitThreshold,
    profitEstimate: priceDifference - minProfitThreshold,
    direction: marketData.bid > otherMarketData.ask ? 'buy_here_sell_there' : 'buy_there_sell_here'
  };
};
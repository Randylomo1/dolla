const WebSocket = require('ws');
const { DERIV_API_URL, DERIV_APP_ID, DERIV_TOKEN, REDIS_URL } = process.env;
const Redis = require('redis');

class DerivWS {
  redis = Redis.createClient({ url: REDIS_URL });
  constructor() {
    this.connection = null;
    this.reconnectInterval = 1000;
    this.ready = false;
  }

  connect() {
    this.connection = new WebSocket(`${DERIV_API_URL}?app_id=${DERIV_APP_ID}`);

    this.connection.on('open', () => {
      console.log('Deriv WS connected');
      this.authenticate();
      this.reconnectInterval = 1000;
    });

    this.connection.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if(msg.error) throw new Error(msg.error.message);
        this.handleMessage(msg);
      } catch(e) {
        console.error('Message processing error:', e);
      }
    });

    this.connection.on('close', () => {
      console.log(`Deriv WS disconnected - attempting reconnect in ${this.reconnectInterval}ms`);
      this.ready = false;
      setTimeout(() => this.connect(), this.reconnectInterval);
      this.reconnectInterval = Math.min(this.reconnectInterval * 2, 30000);
    });
  }

  authenticate() {
    this.send({
      authorize: DERIV_TOKEN
    });
  }

  send(payload) {
    if(this.connection.readyState === WebSocket.OPEN) {
      this.connection.send(JSON.stringify(payload));
    }
  }

  handleMessage(msg) {
    if(msg.msg_type === 'authorize') {
      this.ready = true;
      console.log('Deriv authentication successful');
    }
    else if(msg.error) {
      this.redis.publish('trade-errors', JSON.stringify({
        code: msg.error.code,
        message: msg.error.message,
        timestamp: Date.now()
      }));
    }
    else if(msg.buy || msg.sell) {
      const tradeType = msg.buy ? 'buy' : 'sell';
      this.redis.publish('trade-confirmations', JSON.stringify({
        contract_id: msg[tradeType].contract_id,
        reference_id: msg[tradeType].passthrough.custom_id,
        status: 'filled',
        price: msg[tradeType].ask_price,
        timestamp: msg[tradeType].purchase_time
      }));
    }

  buy(params); {
    if(!this.ready) throw new Error('Deriv WS not authenticated');
    if(!params || !params.amount || !params.symbol) {
      throw new Error('Invalid buy parameters');
    }

    const payload = {
      buy: params.contract_type || 'CALL',
      price: params.amount,
      parameters: {
        amount: params.amount,
        basis: 'stake',
        currency: 'USD',
        duration: params.duration || 5,
        duration_unit: 'm',
        symbol: params.symbol
      },
      passthrough: {
        custom_id: params.reference_id || Date.now().toString()
      }
    };

    this.send(payload);

  sell(position_id); {
    if(!this.ready) throw new Error('Deriv WS not authenticated');
    this.send({
      sell: position_id,
      price: 0
    });
  }
}

  }
}

module.exports = new DerivWS();
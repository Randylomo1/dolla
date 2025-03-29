const WebSocket = require('ws');
const Redis = require('redis');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, REDIS_URL } = process.env;

class AIWebSocketService {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.redis = Redis.createClient({ url: REDIS_URL });
    this.agents = new Map();
    this.initialize();
  }

  async initialize() {
    await this.redis.connect();
    this.redis.subscriber = this.redis.duplicate();
    await this.redis.subscriber.connect();

    // Pub/Sub channels
    await this.redis.subscriber.subscribe('market-data', (msg) => {
      this.broadcast(msg, 'MARKET_DATA');
    });

    await this.redis.subscriber.subscribe('trade-signals', (msg) => {
      this.broadcast(msg, 'TRADE_SIGNAL');
    });

    await this.redis.subscriber.subscribe('coordination-signals', (msg) => {
      this.broadcast(msg, 'COORDINATION_SIGNAL');
    });
  }

  validateMessage(message) {
    try {
      const msg = JSON.parse(message);
      if(!msg.type || !msg.payload) throw new Error('Invalid message format');
      return msg;
    } catch(e) {
      return null;
    }
  }

  authenticate(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch(e) {
      return null;
    }
  }

  broadcast(data, type) {
    const msg = JSON.stringify({ type, payload: data });
    this.wss.clients.forEach(client => {
      if(client.readyState === WebSocket.OPEN) client.send(msg);
    });
  }

  handleConnection(ws) {
    ws.on('message', async (message) => {
      const parsed = this.validateMessage(message);
      if(!parsed) return ws.close(1008, 'Invalid message format');

      switch(parsed.type) {
        case 'AUTH':
          const agent = this.authenticate(parsed.payload.token);
          if(agent) {
            this.agents.set(ws, agent);
            await this.redis.hSet('agent:status', agent.id, JSON.stringify({
              lastHeartbeat: Date.now(),
              server: process.env.HOSTNAME,
              load: 0
            }));
            ws.send(JSON.stringify({ type: 'AUTH_SUCCESS' }));
          } else {
            ws.close(1008, 'Authentication failed');
          }
          break;

        case 'TRADE_EXECUTION':
          if(this.agents.has(ws)) {
            await this.redis.publish('trade-executions', 
              JSON.stringify({
                ...parsed.payload,
                agentId: this.agents.get(ws).id
              })
            );
          }
          break;

        case 'HEARTBEAT':
          if(this.agents.has(ws)) {
            const agentId = this.agents.get(ws).id;
            await this.redis.hSet('agent:status', agentId, JSON.stringify({
              lastHeartbeat: Date.now(),
              server: process.env.HOSTNAME,
              load: parsed.payload.load
            }));
          }
          break;

        case 'AGENT_STATUS':
          if(this.agents.has(ws)) {
            const status = await this.redis.hGetAll('agent:status');
            ws.send(JSON.stringify({
              type: 'AGENT_STATUS',
              payload: Object.values(status).map(JSON.parse)
            }));
          }
          break;

        case 'COORDINATION_SIGNAL':
          await this.redis.publish('coordination-signals', 
            JSON.stringify(parsed.payload)
          );
          break;

        default:
          ws.close(1008, 'Unsupported message type');
      }
    });

    ws.on('close', () => this.agents.delete(ws));
  }

  async balanceAgents() {
    const agentStatus = await this.redis.hGetAll('agent:status');
    const serverLoad = {};

    Object.values(agentStatus).forEach(status => {
      const { server, load } = JSON.parse(status);
      serverLoad[server] = (serverLoad[server] || 0) + load;
    });

    const minLoadServer = Object.entries(serverLoad)
      .sort(([,a], [,b]) => a - b)[0]?.[0] || process.env.HOSTNAME;

    return {
      suggestedServer: minLoadServer,
      currentLoad: serverLoad[process.env.HOSTNAME] || 0
    };
  }
}

module.exports = AIWebSocketService;
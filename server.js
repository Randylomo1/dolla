import express from 'express';
import { createServer } from 'https';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import bodyParser from 'body-parser';
import DerivAPIBasic from 'deriv-api';
import { processMarketData } from './lib/marketDataProcessor.js';
import { manageRisk } from './lib/riskEngine.js';
import { initAIAgents } from './lib/aiOrchestrator.js';
import redis from './lib/aiWSService.js';
import orderSplitter from './lib/orderSplitter.js';
import DerivWS from './lib/derivWS';
import PredictionEngine from './lib/predictionEngine';

const app = express();

// OAuth2 Callback Endpoint
app.get('/api/oauth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    // Validate state parameter
    const storedState = await redis.get(`oauth_state:${state}`);
    if (!storedState) {
      return res.status(400).send('Invalid state parameter');
    }

    // Exchange authorization code for access token
    const tokenResponse = await axios.post(
      `${process.env.DERIV_API_URL}/oauth2/token`, 
      {
        client_id: process.env.DERIV_APP_ID,
        client_secret: process.env.DERIV_TOKEN,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.DERIV_REDIRECT_URI
      }
    );

    // Store tokens securely
    await redis.hSet('deriv_tokens', tokenResponse.data.access_token, 
      JSON.stringify({
        refresh_token: tokenResponse.data.refresh_token,
        expires_at: Date.now() + (tokenResponse.data.expires_in * 1000)
      })
    );

    res.redirect(`${process.env.CORS_ORIGIN}/dashboard?auth_success=true`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${process.env.CORS_ORIGIN}/?auth_error=true`);
  }
});
app.use(cors());
app.use(bodyParser.json());

const httpsOptions = {
  key: fs.readFileSync('./certs/localhost-key.pem'),
  cert: fs.readFileSync('./certs/localhost.pem')
};

const httpServer = createServer(httpsOptions, app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  },
  transports: ['websocket'],
  pingInterval: 1000,
  pingTimeout: 5000,
  perMessageDeflate: {
    threshold: 1024,
    zlibDeflateOptions: {
      level: 3
    }
  },
  maxHttpBufferSize: 1e8,
  httpCompression: true
});

const derivAPI = new DerivAPIBasic({ 
  app_id: process.env.DERIV_APP_ID,
  server: process.env.DERIV_SERVER || 'blue',
  onReady: () => console.log('Deriv WS connection established')
});

// Authentication middleware
app.use('/api', (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token !== process.env.API_SECRET) {
    return res.status(403).json({ error: 'Invalid authentication token' });
  }
  next();
});

// Initialize AI Agent Pool
const aiAgents = initAIAgents({
  strategyPool: ['arbitrage', 'liquidity-seeking', 'sentiment-analysis'],
  maxConcurrent: 100,
  riskThresholds: {
    maxDrawdown: 0.35,
    dailyProfitTarget: 1000000
  }
});

// Initialize prediction engine
const predictionEngine = new PredictionEngine();

// Real-time market data handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Market data subscription handler
  socket.on('subscribe', (channel) => {
    switch(channel) {
      case 'market-data':
        derivAPI.subscribe({ ticks: 'R_100' }).then((response) => {
          response.onUpdate((data) => {
            const processed = processMarketData(data);
            aiAgents.feedMarketData(processed);
            socket.emit('MARKET_DATA', processed);
          });
        });
        break;

      case 'agent-status':
        socket.emit('AGENT_STATUS', aiAgents.getStatus());
        break;
    }
  });

  // Trade execution handler
  socket.on('trade-signal', (signal) => {
    if(manageRisk(signal)) {
      // Batch orders using microtask queue
      orderBatchQueue.push({
        signal,
        receivedAt: process.hrtime.bigint()
      });

      if (!batchTimeout) {
        batchTimeout = setTimeout(() => {
          const batch = orderBatchQueue.splice(0, orderBatchQueue.length);
          const batchPromises = batch.map(({signal, receivedAt}) => {
            return derivAPI.buy(signal)
              .then(confirmation => {
                const processedAt = process.hrtime.bigint();
                const latencyNs = processedAt - receivedAt;
                
                aiAgents.recordTradeOutcome({
                  ...confirmation,
                  latency: Number(latencyNs / 1000n) // Convert to microseconds
                });
                return confirmation;
              });
          });

          Promise.all(batchPromises)
            .then(confirmations => {
              socket.emit('BATCH_CONFIRMATION', confirmations);
            })
            .catch(error => {
              socket.emit('TRADE_ERROR', error);
            });

          batchTimeout = null;
        }, 1); // 1ms batching window
      }
    }
  });

  // Initialize batch processing system
  let orderBatchQueue = [];
  let batchTimeout = null;

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    aiAgents.cleanup(socket.id);
  });
});

// AI Agent management endpoints
// Deriv Bot Builder Endpoints
app.post('/api/deploy-bot', async (req, res) => {
  try {
    const { configuration } = req.body;
    const deployment = await aiAgents.deployDerivBot({
      ...configuration,
      api: derivAPI
    });
    res.status(201).json(deployment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/update-bot', async (req, res) => {
  try {
    const { botId, updates } = req.body;
    await aiAgents.updateDerivBot(botId, updates);
    res.status(200).json({ status: 'UPDATED' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Existing agent endpoint
app.post('/deploy-agent', async (req, res) => {
  const { strategy, parameters } = req.body;
  try {
    const agent = await aiAgents.deploy({
      strategy,
      parameters,
      capitalAllocation: parameters.capital
    });
    res.status(201).json(agent.getConfig());
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/update-risk-parameters', async (req, res) => {
  const { maxDrawdown, dailyLimit } = req.body;
  aiAgents.updateRiskParameters({
    maxDrawdown: parseFloat(maxDrawdown),
    dailyProfitTarget: parseFloat(dailyLimit)
  });
  res.status(200).json({ status: 'UPDATED' });
});

// Performance monitoring endpoint
app.get('/performance-metrics', (req, res) => {
  res.json({
    throughput: aiAgents.getThroughput(),
    latencyStats: aiAgents.getLatencyStats(),
    profitability: aiAgents.getProfitability()
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, async () => {
  console.log(`HFT Server running on port ${PORT}`);
  aiAgents.startHeartbeat();
  await orderSplitter.start();
  predictionEngine.warmup();
});
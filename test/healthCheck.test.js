const request = require('supertest');
const app = require('../server');

describe('Health Check Endpoints', () => {
  test('GET /health/db should return database status', async () => {
    const response = await request(app).get('/health/db');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
  });

  test('GET /health/redis should return Redis status', async () => {
    const response = await request(app).get('/health/redis');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('latency_ms');
  });
});
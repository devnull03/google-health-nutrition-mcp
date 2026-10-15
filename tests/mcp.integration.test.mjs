import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

let mock, baseUrl, requests = [], client, transport;
before(async () => {
  mock = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ method: req.method, url: req.url, authorization: req.headers.authorization, body: body ? JSON.parse(body) : null });
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'POST' && req.url === '/v1/nutrition/food') {
      res.writeHead(201); res.end(JSON.stringify({ id: 'mock-food-1', ...JSON.parse(body) })); return;
    }
    if (req.method === 'GET' && req.url.startsWith('/v1/nutrition?')) {
      res.end(JSON.stringify({ records: [{ name: 'Mock oats', caloriesKcal: 150, proteinGrams: 5 }] })); return;
    }
    res.writeHead(404); res.end(JSON.stringify({ error: 'not found' }));
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${mock.address().port}`;
  transport = new StdioClientTransport({ command: process.execPath, args: ['dist/index.js'], env: { ...process.env, HEALTH_API_BASE_URL: baseUrl, GOOGLE_ACCESS_TOKEN: 'ci-dummy-token-not-a-real-credential' } });
  client = new Client({ name: 'ci-test-client', version: '1.0.0' });
  await client.connect(transport);
});
after(async () => { await client?.close(); await new Promise(resolve => mock?.close(resolve)); });

test('MCP lists nutrition tools and sends food logging request to mock API', async () => {
  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map(t => t.name).sort(), ['log_food', 'read_nutrition']);
  const args = { name: 'Mock oats', consumedAt: '2026-10-15T08:30:00Z', servingSize: 1, servingUnit: 'bowl', caloriesKcal: 150, proteinGrams: 5, carbohydrateGrams: 27, fatGrams: 3 };
  const result = await client.callTool({ name: 'log_food', arguments: args });
  assert.match(result.content[0].text, /mock-food-1/);
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].authorization, 'Bearer ci-dummy-token-not-a-real-credential');
  assert.deepEqual(requests[0].body, args);
});

test('nutrition range tool calls mock API with both dates and returns fixture data', async () => {
  const result = await client.callTool({ name: 'read_nutrition', arguments: { startDate: '2026-10-15', endDate: '2026-10-15' } });
  assert.match(result.content[0].text, /Mock oats/);
  assert.match(requests[1].url, /startDate=2026-10-15/);
  assert.match(requests[1].url, /endDate=2026-10-15/);
});

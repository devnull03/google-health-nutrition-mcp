import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'google-health-nutrition', version: '0.1.0' });
const baseUrl = process.env.HEALTH_API_BASE_URL;
const accessToken = process.env.GOOGLE_ACCESS_TOKEN;

async function api(path: string, init?: RequestInit) {
  if (!baseUrl || !accessToken) throw new Error('Set HEALTH_API_BASE_URL and GOOGLE_ACCESS_TOKEN in .env.');
  const response = await fetch(new URL(path, baseUrl), { ...init, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...init?.headers } });
  if (!response.ok) throw new Error(`Health API returned ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

server.tool('log_food', 'Record a food/nutrition entry through the configured Health Connect bridge API.', {
  name: z.string(), consumedAt: z.string().describe('ISO-8601 timestamp'), servingSize: z.number().positive(), servingUnit: z.string(), caloriesKcal: z.number().nonnegative().optional(), proteinGrams: z.number().nonnegative().optional(), carbohydrateGrams: z.number().nonnegative().optional(), fatGrams: z.number().nonnegative().optional()
}, async (input) => ({ content: [{ type: 'text', text: JSON.stringify(await api('/v1/nutrition/food', { method: 'POST', body: JSON.stringify(input) }), null, 2) }] }));

server.tool('read_nutrition', 'Read nutrition records for a date range from the configured Health Connect bridge API.', {
  startDate: z.string().describe('ISO-8601 date or datetime'), endDate: z.string().describe('ISO-8601 date or datetime')
}, async ({ startDate, endDate }) => {
  const q = new URLSearchParams({ startDate, endDate });
  return { content: [{ type: 'text', text: JSON.stringify(await api(`/v1/nutrition?${q}`), null, 2) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { inventoryStore } from '../storage/inventory-store.js';

const PORT = Number.parseInt(process.env.PORT || '3002', 10);

/**
 * Simple HTTP server for inventory service
 */
export function startServer(): void {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Health check
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'inventory-service' }));
      return;
    }

    // Get all inventory
    if (req.url === '/inventory' && req.method === 'GET') {
      const inventory = Array.from(inventoryStore.getAll().entries()).map(([itemId, item]) => ({
        itemId,
        ...item,
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(inventory));
      return;
    }

    // Get inventory by ID
    if (req.url?.startsWith('/inventory/') && req.method === 'GET') {
      const itemId = req.url.split('/')[2];
      const item = inventoryStore.get(itemId);
      if (item) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ itemId, ...item }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Item not found' }));
      }
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(PORT, () => {
    console.log(`🚀 Inventory Service listening on port ${PORT}`);
  });
}


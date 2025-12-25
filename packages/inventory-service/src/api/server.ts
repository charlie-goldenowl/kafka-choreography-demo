import express, { type Request, type Response } from 'express';
import { inventoryStore } from '../storage/inventory-store.js';

const PORT = Number.parseInt(process.env.PORT || '3002', 10);

/**
 * Express server for inventory service
 */
export function startServer(): void {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'inventory-service' });
  });

  // Get all inventory
  app.get('/inventory', (_req: Request, res: Response) => {
    const inventory = Array.from(inventoryStore.getAll().entries()).map(([itemId, item]) => ({
      itemId,
      ...item,
    }));
    res.json(inventory);
  });

  // Get inventory by ID
  app.get('/inventory/:itemId', (req: Request, res: Response) => {
    const { itemId } = req.params;
    const item = inventoryStore.get(itemId);
    if (item) {
      res.json({ itemId, ...item });
    } else {
      res.status(404).json({ error: 'Item not found' });
    }
  });

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.listen(PORT, () => {
    console.log(`🚀 Inventory Service listening on port ${PORT}`);
  });
}

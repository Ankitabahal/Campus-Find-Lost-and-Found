import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp, initializeDatabase } from './server/src/app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  await initializeDatabase();
  const app = createApp();

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/assets/*', (req, res) => {
      res.status(404).end();
    });
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`CampusFind server running at http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CampusFind server:', err);
  process.exit(1);
});

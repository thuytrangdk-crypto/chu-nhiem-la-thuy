import { createServer as createViteServer } from 'vite';
import path from 'path';
import express from 'express';
import app from './api/index.ts';

const PORT = 3000;

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GVCN Server] Running on http://localhost:${PORT}`);
  });
}

// Do not call app.listen() when running inside Vercel Serverless Function
if (!process.env.VERCEL) {
  startServer();
}

export default app;
export { app };

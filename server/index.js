import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './routes.js';
import './db.js'; // Ensure DB is initialized

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1', routes);

// Serve static assets in production if built
const clientDist = path.resolve(__dirname, '..', 'dist', 'client');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(` Payment Bridge Server running on http://localhost:${PORT}`);
    console.log(` Payhooks Inbound Callback: POST http://localhost:${PORT}/api/v1/callbacks/payhooks`);
    console.log(`======================================================\n`);
  });
}

export default app;

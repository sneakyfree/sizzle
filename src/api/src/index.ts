import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import sessionRoutes from './routes/sessions.js';
import billingRoutes from './routes/billing.js';
import modelsRoutes from './routes/models.js';
import healthRoutes from './routes/health.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Banner
console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 PUMP ME - The most normie-friendly GPU platform 🚀   ║
║                                                           ║
║   "Show up. Click. Feel the speed. Get hooked."           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/health', healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Sizzle API',
    version: '0.1.0',
    message: 'The most normie-friendly GPU compute platform in the world',
    docs: '/api/docs',
  });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Sizzle API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

export default app;

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config';
import { logger } from './services/logger';
import { initDatabase } from './db/database';
import { webhookRouter } from './routes/webhook';
import { metricsRouter } from './routes/metrics';
import { authenticateAPI } from './middleware/auth';
import { pollingService } from './services/polling';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
	origin: false, // Only allow same-origin requests
	credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check (no auth required)
app.get('/health', (_req, res) => {
	res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook routes (custom auth per provider)
app.use('/api/webhook', webhookRouter);

// Metrics API (requires API token)
app.use('/api/metrics', authenticateAPI, metricsRouter);

// Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
	logger.error('Unhandled error:', err);
	res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
	try {
		// Initialize database
		await initDatabase();
		logger.info('Database initialized');

		// Start polling service if configured
		pollingService.start();

		// Start server
		app.listen(env.PORT, () => {
			logger.info(`Server running on port ${env.PORT}`);
		});
	} catch (error) {
		logger.error('Failed to start server:', error);
		process.exit(1);
	}
}

start();
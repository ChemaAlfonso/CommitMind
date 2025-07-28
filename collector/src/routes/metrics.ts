import { Router } from 'express';
import { logger } from '../services/logger';
import { generateAISummary } from '../services/ai';
import { sendToSlack } from '../services/slack';
import { 
	getWeeklyMetrics, 
	getCommitFrequency, 
	getProjectActivity, 
	getWeeklyProductivity, 
	getDailyCommitPatterns 
} from '../services/metrics';

export const metricsRouter = Router();

// Get weekly summary for AI bot
metricsRouter.get('/summary', async (_req, res) => {
	try {
		const metrics = await getWeeklyMetrics();
		res.json(metrics);
	} catch (error) {
		logger.error('Error getting metrics summary:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Get commit frequency data
metricsRouter.get('/commits/frequency', async (_req, res) => {
	try {
		const days = parseInt(_req.query.days as string) || 30;
		const data = await getCommitFrequency(days);
		res.json(data);
	} catch (error) {
		logger.error('Error getting commit frequency:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Get project activity
metricsRouter.get('/projects/activity', async (_req, res) => {
	try {
		const data = await getProjectActivity();
		res.json(data);
	} catch (error) {
		logger.error('Error getting project activity:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Get weekly productivity
metricsRouter.get('/productivity/weekly', async (_req, res) => {
	try {
		const data = await getWeeklyProductivity();
		res.json(data);
	} catch (error) {
		logger.error('Error getting weekly productivity:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Get commit patterns
metricsRouter.get('/commits/patterns', async (_req, res) => {
	try {
		const data = await getDailyCommitPatterns();
		res.json(data);
	} catch (error) {
		logger.error('Error getting commit patterns:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Trigger bot summary generation
metricsRouter.post('/bot/summary', async (_req, res) => {
	try {
		const metrics = await getWeeklyMetrics();
		const summary = await generateAISummary(metrics);
		
		res.json({
			metrics,
			summary,
			generated_at: new Date().toISOString()
		});
	} catch (error) {
		logger.error('Error generating bot summary:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Send summary to Slack
metricsRouter.post('/bot/slack', async (_req, res) => {
	try {
		const metrics = await getWeeklyMetrics();
		const summary = await generateAISummary(metrics);
		await sendToSlack(summary, metrics);
		
		res.json({
			status: 'ok',
			message: 'Summary sent to Slack',
			generated_at: new Date().toISOString()
		});
	} catch (error) {
		logger.error('Error sending bot summary to Slack:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});


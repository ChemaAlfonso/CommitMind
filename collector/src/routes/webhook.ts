import { Router } from 'express';
import { validateGitHubWebhook, validateGitLabWebhook } from '../middleware/webhookValidator';
import { processGitHubWebhook } from '../services/github';
import { processGitLabWebhook } from '../services/gitlab';
import { logger } from '../services/logger';

export const webhookRouter = Router();

// GitHub webhook
webhookRouter.post('/github', validateGitHubWebhook, async (req, res) => {
	try {
		const event = req.headers['x-github-event'] as string;
		logger.info('Received GitHub webhook', { event });
		
		await processGitHubWebhook(event, req.body);
		res.json({ status: 'ok' });
	} catch (error) {
		logger.error('Error processing GitHub webhook:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// GitLab webhook
webhookRouter.post('/gitlab', validateGitLabWebhook, async (req, res) => {
	try {
		const event = req.headers['x-gitlab-event'] as string;
		logger.info('Received GitLab webhook', { event });
		
		await processGitLabWebhook(event, req.body);
		res.json({ status: 'ok' });
	} catch (error) {
		logger.error('Error processing GitLab webhook:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});


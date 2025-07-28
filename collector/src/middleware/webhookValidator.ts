import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config';
import { logger } from '../services/logger';

export function validateGitHubWebhook(req: Request, res: Response, next: NextFunction): void {
	const signature = req.headers['x-hub-signature-256'] as string;
	
	if (!signature) {
		logger.warn('GitHub webhook missing signature', { ip: req.ip });
		res.status(401).json({ error: 'Missing webhook signature' });
		return;
	}
	
	const payload = JSON.stringify(req.body);
	const hmac = crypto.createHmac('sha256', env.GITHUB_WEBHOOK_SECRET);
	const digest = 'sha256=' + hmac.update(payload).digest('hex');
	
	if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
		logger.warn('GitHub webhook invalid signature', { ip: req.ip });
		res.status(401).json({ error: 'Invalid webhook signature' });
		return;
	}
	
	next();
}

export function validateGitLabWebhook(req: Request, res: Response, next: NextFunction): void {
	const token = req.headers['x-gitlab-token'] as string;
	
	if (!token) {
		logger.warn('GitLab webhook missing token', { ip: req.ip });
		res.status(401).json({ error: 'Missing webhook token' });
		return;
	}
	
	if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(env.GITLAB_WEBHOOK_TOKEN))) {
		logger.warn('GitLab webhook invalid token', { ip: req.ip });
		res.status(401).json({ error: 'Invalid webhook token' });
		return;
	}
	
	next();
}

export function validateManualWebhook(req: Request, res: Response, next: NextFunction): void {
	const authHeader = req.headers.authorization;
	
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		logger.warn('Manual webhook missing authorization', { ip: req.ip });
		res.status(401).json({ error: 'Unauthorized' });
		return;
	}
	
	const token = authHeader.substring(7);
	
	if (token !== env.API_TOKEN) {
		logger.warn('Manual webhook invalid token', { ip: req.ip });
		res.status(401).json({ error: 'Unauthorized' });
		return;
	}
	
	next();
}
import { Request, Response, NextFunction } from 'express';
import { env } from '../config';
import { logger } from '../services/logger';

export function authenticateAPI(req: Request, res: Response, next: NextFunction): void {
	const authHeader = req.headers.authorization;
	
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		logger.warn('Missing or invalid authorization header', { ip: req.ip });
		res.status(401).json({ error: 'Unauthorized' });
		return;
	}
	
	const token = authHeader.substring(7);
	
	if (token !== env.API_TOKEN) {
		logger.warn('Invalid API token', { ip: req.ip });
		res.status(401).json({ error: 'Unauthorized' });
		return;
	}
	
	next();
}
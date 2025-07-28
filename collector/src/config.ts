import { config } from 'dotenv';
import { join } from 'path';

config();

export const env = {
	// Server
	NODE_ENV: process.env.NODE_ENV || 'development',
	PORT: parseInt(process.env.PORT || '3000', 10),

	// Database
	SQLITE_PATH: process.env.SQLITE_PATH || join(__dirname, '../../data/metrics.db'),

	// Security
	API_TOKEN: process.env.API_TOKEN || '',
	GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET || '',
	GITLAB_WEBHOOK_TOKEN: process.env.GITLAB_WEBHOOK_TOKEN || '',

	// External APIs
	GITHUB_PAT: process.env.GITHUB_PAT || '',
	GITLAB_PAT: process.env.GITLAB_PAT || '',

	// AI and Slack
	AI_PROVIDER: process.env.AI_PROVIDER || 'openai',
	OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
	ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
	SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || '',

	// Polling configuration
	POLLING_INTERVAL_MINUTES: process.env.POLLING_INTERVAL_MINUTES || 'never',
	POLLING_LOOKBACK_HOURS: parseInt(process.env.POLLING_LOOKBACK_HOURS || '24', 10)
} as const;

// Validate required environment variables
const requiredVars = ['API_TOKEN', 'GITHUB_WEBHOOK_SECRET', 'GITLAB_WEBHOOK_TOKEN'];
const missing = requiredVars.filter(key => !env[key as keyof typeof env]);

if (missing.length > 0 && env.NODE_ENV === 'production') {
	throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}
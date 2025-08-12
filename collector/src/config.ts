import { config } from 'dotenv';
import { join } from 'path';

config();

export const env = {
	// Server
	NODE_ENV: process.env.NODE_ENV || 'development',
	PORT: parseInt(process.env.PORT || '3000', 10),
	API_URL: process.env.API_URL || 'http://localhost:3000',

	// Database
	SQLITE_PATH: process.env.SQLITE_PATH || join(__dirname, '../../data/metrics.db'),

	// Security
	API_TOKEN: process.env.API_TOKEN || '',
	GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET || '',
	GITLAB_WEBHOOK_TOKEN: process.env.GITLAB_WEBHOOK_TOKEN || '',

	// External APIs
	GITHUB_PAT: process.env.GITHUB_PAT || '',
	GITLAB_PAT: process.env.GITLAB_PAT || '',

	// AI and Notifications
	AI_PROVIDER: process.env.AI_PROVIDER || 'openai',
	OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
	ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
	ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
	OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-5-mini',
	
	// Slack configuration
	SLACK_ENABLED: process.env.SLACK_ENABLED === 'true',
	SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || '',
	
	// Email configuration
	EMAIL_ENABLED: process.env.EMAIL_ENABLED === 'true',
	EMAIL_SMTP_HOST: process.env.EMAIL_SMTP_HOST || '',
	EMAIL_SMTP_PORT: parseInt(process.env.EMAIL_SMTP_PORT || '587', 10),
	EMAIL_SMTP_SECURE: process.env.EMAIL_SMTP_SECURE === 'true',
	EMAIL_SMTP_USER: process.env.EMAIL_SMTP_USER || '',
	EMAIL_SMTP_PASS: process.env.EMAIL_SMTP_PASS || '',
	EMAIL_FROM: process.env.EMAIL_FROM || '',
	EMAIL_TO: process.env.EMAIL_TO || '',

	// Polling configuration
	POLLING_INTERVAL_MINUTES: process.env.POLLING_INTERVAL_MINUTES || 'never',
	POLLING_LOOKBACK_HOURS: parseInt(process.env.POLLING_LOOKBACK_HOURS || '24', 10),

	// Logging configuration
	LOG_LEVEL: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
	LOG_TO_CONSOLE: process.env.LOG_TO_CONSOLE !== 'false',
	LOG_TO_FILE: process.env.LOG_TO_FILE !== 'false',
	LOG_FILE_LEVEL: process.env.LOG_FILE_LEVEL || process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),

	// Reporting configuration
	REPORTS_LANGUAGE: process.env.REPORTS_LANGUAGE || 'English'
} as const;

// Validate required environment variables
const requiredVars = ['API_TOKEN', 'GITHUB_WEBHOOK_SECRET', 'GITLAB_WEBHOOK_TOKEN'];
const missing = requiredVars.filter(key => !env[key as keyof typeof env]);

if (missing.length > 0 && env.NODE_ENV === 'production') {
	throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}
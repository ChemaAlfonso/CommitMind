import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../.env') });

export const env = {
	// Environment
	NODE_ENV: process.env.NODE_ENV || 'development',
	
	// API Configuration
	API_TOKEN: process.env.API_TOKEN || '',
	API_URL: process.env.API_URL || 'http://collector:3000',
	
	// Database
	SQLITE_PATH: process.env.SQLITE_PATH || join(__dirname, '../../data/metrics.db'),
	
	// Scheduling
	REPORT_DAY: parseInt(process.env.REPORT_DAY || '5', 10), // 0=Sunday, 5=Friday
	REPORT_HOUR: parseInt(process.env.REPORT_HOUR || '17', 10), // 24-hour format
	TZ: process.env.TZ || 'Europe/Madrid',
	RUN_ON_START: process.env.RUN_ON_START === 'true',
	
	// Logging configuration
	LOG_LEVEL: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
	LOG_TO_CONSOLE: process.env.LOG_TO_CONSOLE !== 'false',
	LOG_TO_FILE: process.env.LOG_TO_FILE !== 'false',
	LOG_FILE_LEVEL: process.env.LOG_FILE_LEVEL || process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
} as const;
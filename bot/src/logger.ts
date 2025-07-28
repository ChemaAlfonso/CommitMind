import pino from 'pino';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { env } from './config';

// Ensure logs directory exists
// In Docker, we use /app/logs which is mapped to host ./logs
const logsDir = env.NODE_ENV === 'production' ? '/app/logs' : join(__dirname, '../../logs');
if (!existsSync(logsDir)) {
	mkdirSync(logsDir, { recursive: true });
}

// Logger configuration from centralized config
const LOG_LEVEL = env.LOG_LEVEL;
const LOG_TO_CONSOLE = env.LOG_TO_CONSOLE;
const LOG_TO_FILE = env.LOG_TO_FILE;
const LOG_FILE_LEVEL = env.LOG_FILE_LEVEL;

// Create transports based on configuration
const transports: pino.TransportTargetOptions[] = [];

// Console transport
if (LOG_TO_CONSOLE) {
	transports.push({
		target: 'pino-pretty',
		options: {
			colorize: true,
			ignore: 'pid,hostname',
			translateTime: 'SYS:standard',
			singleLine: false
		},
		level: LOG_LEVEL
	});
}

// File transport
if (LOG_TO_FILE) {
	const logFileName = `bot-${new Date().toISOString().split('T')[0]}.log`;
	const logFilePath = join(logsDir, logFileName);
	transports.push({
		target: 'pino/file',
		options: {
			destination: logFilePath,
			mkdir: true
		},
		level: LOG_FILE_LEVEL
	});
	// Log where we're writing
	console.log(`Bot logs will be written to: ${logFilePath}`);
}

// Create logger with transports
export const logger = transports.length > 0
	? pino({
		level: LOG_LEVEL,
		timestamp: pino.stdTimeFunctions.isoTime
	}, pino.transport({
		targets: transports
	}))
	: pino({
		level: LOG_LEVEL,
		timestamp: pino.stdTimeFunctions.isoTime
	});

// Log startup configuration
logger.info({
	msg: 'CommitMind bot logger initialized',
	config: {
		logLevel: LOG_LEVEL,
		logToConsole: LOG_TO_CONSOLE,
		logToFile: LOG_TO_FILE,
		fileLogLevel: LOG_FILE_LEVEL,
		environment: env.NODE_ENV,
		logsDirectory: logsDir
	}
});
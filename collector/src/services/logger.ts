import pino from 'pino';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { env } from '../config';

// Ensure logs directory exists
// In Docker, we use /app/logs which is mapped to host ./logs
const logsDir = env.NODE_ENV === 'production' ? '/app/logs' : join(__dirname, '../../../logs');
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
	const logFileName = `collector-${new Date().toISOString().split('T')[0]}.log`;
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
	console.log(`Collector logs will be written to: ${logFilePath}`);
}

// Create Pino logger instance (internal)
const pinoLogger = transports.length > 0
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

// Helper function to reorder arguments if needed
function formatArgs(args: any[]): any[] {
	// If we have exactly 2 args, first is string, second is object/error
	if (args.length === 2 && typeof args[0] === 'string' && 
		(typeof args[1] === 'object' || args[1] instanceof Error)) {
		// Swap them for Pino
		return [args[1], args[0]];
	}
	// Otherwise pass through as-is
	return args;
}

// Create wrapper that adapts our logging pattern to Pino's expected format
// Our pattern: logger.error('message', object) → Pino expects: logger.error(object, 'message')
export const logger = {
	info(...args: any[]) {
		const formattedArgs = formatArgs(args);
		return (pinoLogger.info as any)(...formattedArgs);
	},

	error(...args: any[]) {
		const formattedArgs = formatArgs(args);
		return (pinoLogger.error as any)(...formattedArgs);
	},

	warn(...args: any[]) {
		const formattedArgs = formatArgs(args);
		return (pinoLogger.warn as any)(...formattedArgs);
	},

	debug(...args: any[]) {
		const formattedArgs = formatArgs(args);
		return (pinoLogger.debug as any)(...formattedArgs);
	},

	trace(...args: any[]) {
		const formattedArgs = formatArgs(args);
		return (pinoLogger.trace as any)(...formattedArgs);
	},

	fatal(...args: any[]) {
		const formattedArgs = formatArgs(args);
		return (pinoLogger.fatal as any)(...formattedArgs);
	},

	// Child logger support
	child(bindings: pino.Bindings) {
		const childPino = pinoLogger.child(bindings);
		return {
			info(...args: any[]) { 
				const formattedArgs = formatArgs(args);
				return (childPino.info as any)(...formattedArgs); 
			},
			error(...args: any[]) { 
				const formattedArgs = formatArgs(args);
				return (childPino.error as any)(...formattedArgs); 
			},
			warn(...args: any[]) { 
				const formattedArgs = formatArgs(args);
				return (childPino.warn as any)(...formattedArgs); 
			},
			debug(...args: any[]) { 
				const formattedArgs = formatArgs(args);
				return (childPino.debug as any)(...formattedArgs); 
			},
			trace(...args: any[]) { 
				const formattedArgs = formatArgs(args);
				return (childPino.trace as any)(...formattedArgs); 
			},
			fatal(...args: any[]) { 
				const formattedArgs = formatArgs(args);
				return (childPino.fatal as any)(...formattedArgs); 
			}
		};
	}
};

// Log startup configuration
logger.info({
	msg: 'CommitMind collector logger initialized',
	config: {
		logLevel: LOG_LEVEL,
		logToConsole: LOG_TO_CONSOLE,
		logToFile: LOG_TO_FILE,
		fileLogLevel: LOG_FILE_LEVEL,
		environment: env.NODE_ENV,
		logsDirectory: logsDir
	}
});
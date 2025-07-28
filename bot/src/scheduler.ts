import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';
import { env } from './config';

const execAsync = promisify(exec);

// Get config from centralized config
const REPORT_DAY = env.REPORT_DAY;
const REPORT_HOUR = env.REPORT_HOUR;
const TIMEZONE = env.TZ;

// Calculate milliseconds until next scheduled report
function getNextScheduledTime(): Date {
	const now = new Date();
	const local = new Date(now.toLocaleString("en-US", {timeZone: TIMEZONE}));
	
	// Get day of week (0 = Sunday)
	const day = local.getDay();
	const hour = local.getHours();
	
	// Calculate days until report day
	let daysUntilReport = (REPORT_DAY - day + 7) % 7;
	
	// If it's already the report day
	if (daysUntilReport === 0) {
		// If it's past report hour, schedule for next week
		if (hour >= REPORT_HOUR) {
			daysUntilReport = 7;
		}
	}
	
	// Set target date
	const target = new Date(local);
	target.setDate(target.getDate() + daysUntilReport);
	target.setHours(REPORT_HOUR, 0, 0, 0);
	
	return target;
}

async function runWeeklySummary() {
	logger.info('Running commit-based developer metrics summary...');
	try {
		const { stdout, stderr } = await execAsync('node /app/dist/index.js');
		if (stdout) logger.info({ stdout }, 'Summary execution output');
		if (stderr) logger.error({ stderr }, 'Summary execution error output');
	} catch (error) {
		logger.error({ error }, 'Error running metrics summary');
	}
}

async function scheduler() {
	const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	logger.info({ reportDay: dayNames[REPORT_DAY], reportHour: REPORT_HOUR, timezone: TIMEZONE }, 'Metrics summary scheduler started');
	
	// Run immediately if requested via config
	if (env.RUN_ON_START) {
		await runWeeklySummary();
	}
	
	// Schedule weekly runs
	while (true) {
		const next = getNextScheduledTime();
		const msUntilNext = next.getTime() - Date.now();
		
		logger.info({ nextRun: next.toISOString() }, 'Next metrics summary scheduled');
		logger.info({ waitMinutes: Math.round(msUntilNext / 1000 / 60) }, 'Waiting for next scheduled run');
		
		// Wait until next scheduled time
		await new Promise(resolve => setTimeout(resolve, msUntilNext));
		
		// Run the summary
		await runWeeklySummary();
		
		// Small delay to avoid double runs
		await new Promise(resolve => setTimeout(resolve, 60000));
	}
}

// Start the scheduler
scheduler().catch(error => {
	logger.error({ error }, 'Scheduler error');
	process.exit(1);
});
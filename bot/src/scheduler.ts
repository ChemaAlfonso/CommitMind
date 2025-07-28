import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Get config from environment
const REPORT_DAY = parseInt(process.env.REPORT_DAY || '5'); // 0=Sunday, 5=Friday
const REPORT_HOUR = parseInt(process.env.REPORT_HOUR || '17'); // 24-hour format
const TIMEZONE = process.env.TZ || 'Europe/Madrid';

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
	console.log('Running commit-based developer metrics summary...');
	try {
		const { stdout, stderr } = await execAsync('node /app/dist/index.js');
		if (stdout) console.log(stdout);
		if (stderr) console.error(stderr);
	} catch (error) {
		console.error('Error running metrics summary:', error);
	}
}

async function scheduler() {
	const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	console.log(`Metrics summary scheduler started - Reports on ${dayNames[REPORT_DAY]} at ${REPORT_HOUR}:00 ${TIMEZONE}`);
	
	// Run immediately if requested via environment variable
	if (process.env.RUN_ON_START === 'true') {
		await runWeeklySummary();
	}
	
	// Schedule weekly runs
	while (true) {
		const next = getNextScheduledTime();
		const msUntilNext = next.getTime() - Date.now();
		
		console.log(`Next metrics summary scheduled for: ${next.toISOString()}`);
		console.log(`Waiting ${Math.round(msUntilNext / 1000 / 60)} minutes...`);
		
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
	console.error('Scheduler error:', error);
	process.exit(1);
});
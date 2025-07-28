import nodemailer from 'nodemailer';
import { env } from '../config';
import { logger } from './logger';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
	if (!transporter) {
		transporter = nodemailer.createTransport({
			host: env.EMAIL_SMTP_HOST,
			port: env.EMAIL_SMTP_PORT,
			secure: env.EMAIL_SMTP_SECURE,
			auth: {
				user: env.EMAIL_SMTP_USER,
				pass: env.EMAIL_SMTP_PASS
			}
		});
	}
	return transporter;
}

export async function sendEmail(summary: string, metrics: any): Promise<void> {
	if (!env.EMAIL_ENABLED) {
		logger.debug('Email notifications are disabled');
		return;
	}

	if (!env.EMAIL_SMTP_HOST || !env.EMAIL_FROM || !env.EMAIL_TO) {
		throw new Error('Email configuration incomplete: EMAIL_SMTP_HOST, EMAIL_FROM, and EMAIL_TO are required');
	}

	// Convert markdown to HTML for better email formatting
	const htmlSummary = summary
		.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // Bold
		.replace(/\*(.*?)\*/g, '<em>$1</em>')             // Italic
		.replace(/^#{1,6}\s(.*)$/gm, '<h3>$1</h3>')       // Headers
		.replace(/```[\s\S]*?```/g, '')                    // Remove code blocks
		.replace(/`([^`]+)`/g, '<code>$1</code>')         // Inline code
		.replace(/\n/g, '<br>')                            // Line breaks
		.trim();

	const htmlContent = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
			line-height: 1.6;
			color: #333;
			max-width: 600px;
			margin: 0 auto;
			padding: 20px;
		}
		h1 {
			color: #2563eb;
			border-bottom: 2px solid #e5e7eb;
			padding-bottom: 10px;
		}
		h3 {
			color: #1f2937;
			margin-top: 20px;
		}
		.metrics-grid {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 15px;
			margin: 20px 0;
		}
		.metric-card {
			background: #f3f4f6;
			padding: 15px;
			border-radius: 8px;
		}
		.metric-label {
			font-weight: bold;
			color: #4b5563;
			display: block;
			margin-bottom: 5px;
		}
		.metric-value {
			font-size: 24px;
			color: #1f2937;
		}
		.footer {
			margin-top: 30px;
			padding-top: 20px;
			border-top: 1px solid #e5e7eb;
			font-size: 12px;
			color: #6b7280;
			text-align: center;
		}
		code {
			background: #f3f4f6;
			padding: 2px 4px;
			border-radius: 3px;
			font-family: monospace;
		}
	</style>
</head>
<body>
	<div style="text-align: center; margin-bottom: 30px;">
		<h2 style="color: #6366f1; margin: 0;">🧠 CommitMind</h2>
		<p style="color: #6b7280; margin: 5px 0;">Automated Developer Contribution Tracking</p>
	</div>
	<h1>📊 Reporte Semanal de Métricas de Desarrollo</h1>
	
	<div style="margin: 20px 0;">
		${htmlSummary}
	</div>
	
	<h3>📈 Métricas de la Semana</h3>
	<div class="metrics-grid">
		<div class="metric-card">
			<span class="metric-label">Total de Commits</span>
			<span class="metric-value">${metrics.totalCommits || 0}</span>
		</div>
		<div class="metric-card">
			<span class="metric-label">Proyectos Activos</span>
			<span class="metric-value">${metrics.activeProjects || 0}</span>
		</div>
		<div class="metric-card">
			<span class="metric-label">Días Activos</span>
			<span class="metric-value">${metrics.activeDays || 0}</span>
		</div>
		<div class="metric-card">
			<span class="metric-label">PRs Fusionados</span>
			<span class="metric-value">${metrics.prsMerged || 0}</span>
		</div>
	</div>
	
	<div class="footer">
		<p>⏰ Generado el ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
		<p style="margin-top: 10px;">🧠 Powered by CommitMind</p>
	</div>
</body>
</html>
	`;

	const mailOptions = {
		from: env.EMAIL_FROM,
		to: env.EMAIL_TO,
		subject: `🧠 CommitMind - Reporte Semanal de Métricas - ${new Date().toLocaleDateString('es-ES')}`,
		text: summary + '\n\n' + Object.entries(metrics).map(([key, value]) => `${key}: ${value}`).join('\n'),
		html: htmlContent
	};

	try {
		const info = await getTransporter().sendMail(mailOptions);
		logger.info('Metrics summary sent via email', { messageId: info.messageId });
	} catch (error) {
		logger.error('Error sending email:', error);
		throw new Error('Failed to send metrics via email');
	}
}
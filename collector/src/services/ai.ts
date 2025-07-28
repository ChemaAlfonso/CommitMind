import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config';
import { logger } from './logger';

export async function generateAISummary(metrics: any): Promise<string> {
	const prompt = `Eres un analista de productividad de desarrolladores. Analiza estas métricas semanales y proporciona insights EN ESPAÑOL:

${JSON.stringify(metrics, null, 2)}

Áreas de enfoque principales:
1. Patrones de commits y consistencia
2. Distribución de actividad por proyecto
3. Tendencias de productividad y cambios semana a semana
4. Balance trabajo-vida (basado en horas de commits)
5. Patrones de colaboración (PRs fusionados, proyectos activos)

${metrics.deploymentStats ? 'También nota: Se realizaron ' + metrics.deploymentStats.deployments + ' despliegues esta semana.' : ''}

Proporciona insights accionables sobre la efectividad y salud del desarrollador. Sé alentador y constructivo. Mantenlo conciso.
IMPORTANTE: Responde en español y usa formato simple sin markdown (no uses **, *, #, etc).`;

	try {
		if (env.AI_PROVIDER === 'anthropic' && env.ANTHROPIC_API_KEY) {
			const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
			const response = await anthropic.messages.create({
				model: 'claude-3-opus-20240229',
				messages: [{ role: 'user', content: prompt }],
				max_tokens: 500
			});
			return response.content[0].type === 'text' ? response.content[0].text : 'Unable to generate summary';
		} else if (env.OPENAI_API_KEY) {
			const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
			const response = await openai.chat.completions.create({
				model: 'gpt-4o-mini',
				messages: [{ role: 'user', content: prompt }],
				max_tokens: 500
			});
			return response.choices[0].message.content || 'Unable to generate summary';
		} else {
			return 'No AI provider configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY.';
		}
	} catch (error) {
		logger.error('Error generating AI summary:', error);
		return 'Error generating AI summary. Please check your API keys and try again.';
	}
}
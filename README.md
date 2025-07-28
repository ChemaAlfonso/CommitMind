# Lean Dev Metrics

Automated developer contribution tracking for GitHub/GitLab with AI-powered insights and productivity visualization.

## What It Does

- **Tracks** commits and pull/merge requests from GitHub/GitLab
- **Collects** data via webhooks (real-time) or polling (periodic)
- **Visualizes** developer activity patterns in Grafana dashboards
- **Generates** AI-powered weekly summaries with insights
- **Sends** automated reports to Slack

## Quick Start

### Development

```bash
# Clone and start development environment
npm run dev
```

This automatically:
- Creates `.env.local` with development defaults
- Installs dependencies
- Starts API on http://localhost:3000
- Starts Grafana on http://localhost:3001
- Uses `dev-token-123` as API token

### Production

```bash
# Build for production
npm run build

# Deploy to server
rsync -avz dist/ user@your-server:/path/to/lean-dev-metrics/

# On server
docker compose up -d
```

## Configuration

### Required Environment Variables

```bash
# Security (generate strong random tokens)
API_TOKEN=your-long-random-api-token
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret
GITLAB_WEBHOOK_TOKEN=your-gitlab-webhook-token

# Grafana
GF_SECURITY_ADMIN_PASSWORD=your-grafana-admin-password
```

### GitHub Personal Access Token (PAT)

Create a PAT with these permissions:
- `repo` - Full control of private repositories
- `read:user` - Read user profile data

```bash
GITHUB_PAT=ghp_your_github_personal_access_token
```

### GitLab Personal Access Token (PAT)

Create a PAT with these permissions:
- `read_api` - Read access to the API
- `read_repository` - Read repository data

```bash
GITLAB_PAT=glpat_your_gitlab_personal_access_token
```

### Optional Configuration

```bash
# AI Summary (choose one provider)
AI_PROVIDER=openai              # or 'anthropic'
OPENAI_API_KEY=sk-...           # If using OpenAI
ANTHROPIC_API_KEY=sk-ant-...    # If using Anthropic

# Slack notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Weekly report scheduling
REPORT_DAY=5                     # 0=Sunday, 5=Friday
REPORT_HOUR=17                   # 24-hour format
TZ=Europe/Madrid                 # Timezone

# Polling configuration
POLLING_INTERVAL_MINUTES=60      # Set to 'never' to disable
POLLING_LOOKBACK_HOURS=24        # How far back to check
```

## Webhook Setup

### GitHub Webhooks

1. Go to **Settings → Webhooks → Add webhook**
2. **Payload URL**: `https://your-domain.com/api/webhook/github`
3. **Content type**: `application/json`
4. **Secret**: Same as `GITHUB_WEBHOOK_SECRET`
5. **Events**: Select individual events:
   - Push events
   - Pull requests

### GitLab Webhooks

1. Go to **Settings → Webhooks**
2. **URL**: `https://your-domain.com/api/webhook/gitlab`
3. **Secret token**: Same as `GITLAB_WEBHOOK_TOKEN`
4. **Trigger events**:
   - Push events
   - Merge request events

## API Endpoints

### Public Endpoints

```bash
# Health check
curl https://your-domain.com/api/health

# Webhook endpoints (authenticated via webhook secrets)
POST /api/webhook/github
POST /api/webhook/gitlab
```

### Authenticated Endpoints

All require `Authorization: Bearer YOUR_API_TOKEN` header:

```bash
# Get weekly summary
GET /api/metrics/summary

# Get commit frequency (last 30 days)
GET /api/metrics/commits/frequency

# Get project activity
GET /api/metrics/projects/activity

# Generate AI summary
POST /api/metrics/bot/summary

# Send Slack report
POST /api/metrics/bot/slack
```

## Scripts & Commands

### Development Commands

```bash
# Get AI summary
npm run summary

# Send Slack report
npm run report

# Seed historical data (from 2024-01-01)
npm run seed

# Seed from specific date
npm run seed 2023-01-01
```

### Production Commands

```bash
# From dist/collector directory
npm run summary:prod
npm run report:prod
npm run seed:prod [date]
```

## Architecture

```
collector/              # Express API (TypeScript)
├── src/
│   ├── config.ts      # Environment configuration
│   ├── db/            # SQLite database layer
│   ├── routes/        # API endpoints
│   ├── services/      # GitHub/GitLab/AI integrations
│   └── scripts/       # Utility scripts

bot/                   # Weekly report scheduler
├── src/
│   ├── index.ts       # Main report generator
│   └── scheduler.ts   # Cron scheduler

grafana/               # Dashboard configuration
└── provisioning/      # Auto-provisioned dashboards
```

## Data Collection Methods

### 1. Webhooks (Real-time)
- Instant updates when events occur
- Requires webhook configuration in GitHub/GitLab
- Most reliable for real-time tracking

### 2. Polling (Periodic)
- Configured via `POLLING_INTERVAL_MINUTES`
- Catches any missed webhook events
- Checks for changes in the last `POLLING_LOOKBACK_HOURS`

### 3. Historical Seeding
- Import past data using `npm run seed`
- Processes all accessible repositories
- Prevents duplicates automatically

## Deployment

### Docker Deployment

1. **Build and upload**:
   ```bash
   npm run build
   rsync -avz dist/ user@server:/path/to/app/
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Start services**:
   ```bash
   docker compose up -d
   ```

### Nginx Configuration (Optional)

For production deployment with custom domains:

1. **API domain** (e.g., `api.yourdomain.com`):
   - Exposes webhook endpoints publicly
   - Restricts metrics endpoints to internal network

2. **Dashboard domain** (e.g., `dashboard.yourdomain.com`):
   - Grafana interface
   - Should be restricted to VPN/internal network

## Metrics Tracked

### Developer Activity Metrics

1. **Commit Frequency**: Daily and hourly commit patterns
2. **Active Projects**: Which repositories you're contributing to
3. **PR/MR Activity**: Pull requests and merge requests created and merged
4. **Weekly Trends**: Week-over-week changes in activity
5. **Work Patterns**: When you're most productive (hourly distribution)

### Dashboard Visualizations

- **Commit Frequency Chart**: 30-day trend of daily commits
- **Daily Commit Pattern**: Hourly distribution showing when you code
- **Weekly Stats**: Total commits, active projects, and PRs this week
- **Top Projects**: Most active repositories by commit count
- **Project Activity Summary**: Detailed breakdown by repository

## Troubleshooting

### Check Service Health

```bash
# API health
curl http://localhost:3000/health

# Container logs
docker compose logs -f collector
docker compose logs -f grafana
docker compose logs -f bot

# Database
sqlite3 data/metrics.db ".tables"
```

### Common Issues

1. **"Forbidden" errors**: Check PAT permissions
2. **No data appearing**: 
   - Verify webhooks are configured correctly
   - Check polling is enabled if not using webhooks
   - Review container logs for errors
3. **Missing metrics**: Run historical seed to backfill data

## Security Notes

- Store all tokens and secrets securely
- Use strong, random values for API tokens
- Restrict Grafana access to internal network
- Never commit `.env` files to version control
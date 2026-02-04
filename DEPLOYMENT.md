# Sizzle - Deployment Guide

## 🚀 Quick Start (Development)

```bash
# 1. Clone the repo
git clone https://github.com/sneakyfree/Sizzle.git
cd Sizzle

# 2. Copy environment file
cp .env.example .env

# 3. Start services with Docker Compose
docker-compose up -d db redis

# 4. Run database migrations
cd src/api
npm install
npx prisma migrate dev
cd ../..

# 5. Start API (development)
cd src/api
npm run dev

# 6. Start Web (in another terminal)
cd src/web
npm install
npm run dev
```

## 🔧 Environment Variables

### Required for Production

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/sizzle` |
| `JWT_SECRET` | Secret for JWT tokens (64+ chars) | `your-super-secret-key` |
| `STRIPE_SECRET_KEY` | Stripe API secret key | `sk_live_...` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `FRONTEND_URL` | Frontend URL for redirects | `https://pump.me` |

### GPU Providers (Optional)

| Variable | Description |
|----------|-------------|
| `LOCAL_PROVIDER_ENABLED` | Enable local GPU (Veron 1) |
| `LOCAL_OLLAMA_URL` | Ollama API URL |
| `VAST_API_KEY` | Vast.ai API key |
| `VAST_ENABLED` | Enable Vast.ai provider |
| `RUNPOD_API_KEY` | RunPod API key |
| `RUNPOD_ENABLED` | Enable RunPod provider |

## 📦 Production Deployment

### Option 1: Docker Compose (Recommended)

```bash
# 1. Set environment variables
export JWT_SECRET="$(openssl rand -hex 32)"
export DB_PASSWORD="$(openssl rand -hex 16)"
export STRIPE_SECRET_KEY="sk_live_..."
# ... etc

# 2. Deploy
docker-compose --profile production up -d

# 3. Run migrations
docker-compose exec api npx prisma migrate deploy
```

### Option 2: Vercel + Railway

**Frontend (Vercel):**
1. Connect GitHub repo to Vercel
2. Set root directory to `src/web`
3. Add environment variables
4. Deploy

**Backend (Railway):**
1. Create new project from GitHub
2. Set root directory to `src/api`
3. Add PostgreSQL + Redis plugins
4. Configure environment variables
5. Deploy

### Option 3: Manual VPS

```bash
# On your server
git clone https://github.com/sneakyfree/Sizzle.git
cd Sizzle

# Install dependencies
cd src/api && npm ci && npm run build && cd ..
cd src/web && npm ci && npm run build && cd ..

# Set up systemd services
# (see /deploy/systemd/ for service files)

# Set up nginx
# (see nginx.conf.example)

# Start services
systemctl start sizzle-api sizzle-web
```

## 🗄️ Database Migrations

```bash
# Generate migration after schema changes
npx prisma migrate dev --name description_of_change

# Apply migrations in production
npx prisma migrate deploy

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

## 💳 Stripe Setup

1. Create Stripe account at https://stripe.com
2. Get API keys from Dashboard → Developers → API keys
3. Create products/prices:
   - Credit packages (one-time)
   - Subscriptions (recurring)
4. Set up webhook endpoint:
   - URL: `https://your-api.com/api/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed`
5. Get webhook signing secret

## 🖥️ GPU Provider Setup

### Local (Veron 1)
- Ensure Ollama is running: `http://veron1.thewindstorm.uk:11434`
- Set `LOCAL_PROVIDER_ENABLED=true`

### Vast.ai
1. Create account at https://vast.ai
2. Get API key from Account → API Keys
3. Set `VAST_API_KEY` and `VAST_ENABLED=true`

### RunPod
1. Create account at https://runpod.io
2. Get API key from Settings → API Keys
3. Set `RUNPOD_API_KEY` and `RUNPOD_ENABLED=true`

## 🔍 Health Checks

```bash
# API health
curl http://localhost:3001/api/health

# Provider health
curl http://localhost:3001/api/health/providers

# Web health
curl http://localhost:3000
```

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
docker-compose ps db

# Check connection
docker-compose exec db psql -U sizzle -d sizzle -c "SELECT 1"
```

### Stripe Webhook Issues
```bash
# Use Stripe CLI for local testing
stripe listen --forward-to localhost:3001/api/billing/webhook
```

### GPU Provider Issues
```bash
# Check provider health
curl http://localhost:3001/api/sessions/providers
```

## 📊 Monitoring

Recommended tools:
- **Logs**: Docker logs, Papertrail, Logtail
- **Metrics**: Prometheus + Grafana
- **Errors**: Sentry
- **Uptime**: UptimeRobot, Better Stack

## 🔒 Security Checklist

- [ ] Set strong JWT_SECRET (64+ chars)
- [ ] Enable HTTPS in production
- [ ] Set proper CORS origins
- [ ] Use production Stripe keys
- [ ] Enable rate limiting
- [ ] Set up firewall rules
- [ ] Regular security updates

# 💪 PUMP ME

> *The most normie-friendly GPU compute platform in the world.*

**Rent beast-mode hardware by the minute. No Linux. No terminals. Just results.**

---

## 🎯 What is Sizzle?

Sizzle is the "Airbnb for Compute" — a consumer-friendly GPU rental platform that makes high-performance AI compute accessible to everyone.

- **5 FREE Beast Mode minutes** for new users
- **Per-minute billing** — Pay only for what you use
- **No Linux required** — Just click and pump

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎛️ **Push-button simplicity** | No terminal, no Linux knowledge required |
| ⏱️ **Per-minute billing** | Like Kinko's, pay only for what you use |
| 🧠 **Model library** | Top 50+ models pre-configured and ready |
| 🔒 **Private by design** | Your data stays yours |
| 🏎️ **Beast-mode hardware** | H100, B300 clusters on demand |
| 🎯 **Smart provider selection** | Auto-routes to cheapest/fastest GPU |

---

## 🎮 GPU Tiers

| Tier | GPU | Price | Best For |
|------|-----|-------|----------|
| **Starter** | RTX 5090 | $0.15/min | Learning, small models |
| **Pro** | A100 80GB | $0.45/min | Production workloads |
| **Beast** | 8x H100 NVLink | $1.50/min | Training, large models |
| **Ultra** | 16x B300 | $4.00/min | Maximum performance |

---

## 🏗️ Project Structure

```
sizzle/
├── README.md              # You are here
├── DNA-MASTER-PLAN.md     # Complete blueprint
├── DEPLOYMENT.md          # Deployment guide
├── docker-compose.yml     # Production deployment
├── .env.example           # Environment template
├── prisma/
│   └── schema.prisma      # Database schema
├── src/
│   ├── api/               # Express API server
│   │   ├── src/
│   │   │   ├── routes/    # API routes
│   │   │   ├── providers/ # GPU providers
│   │   │   ├── lib/       # Prisma, Stripe
│   │   │   └── middleware/
│   │   └── Dockerfile
│   └── web/               # Next.js frontend
│       ├── app/           # Pages
│       ├── lib/           # API client, hooks
│       └── Dockerfile
└── docs/                  # Documentation
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- Stripe account

### Development

```bash
# Clone
git clone https://github.com/sneakyfree/Sizzle.git
cd Sizzle

# Environment
cp .env.example .env
# Edit .env with your keys

# Database
cd src/api
npm install
npx prisma migrate dev
npm run dev

# Frontend (new terminal)
cd src/web
npm install
npm run dev
```

### Production

```bash
# Using Docker Compose
docker-compose up -d

# Run migrations
docker-compose exec api npx prisma migrate deploy
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

---

## 📡 API Endpoints

### Auth
- `POST /api/auth/register` - Create account (5 free minutes!)
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user

### Sessions
- `GET /api/sessions/tiers` - List GPU tiers
- `POST /api/sessions/create` - Start a session
- `GET /api/sessions/:id` - Get session status
- `POST /api/sessions/:id/stop` - Stop session

### Billing
- `GET /api/billing/packages` - Credit packages
- `POST /api/billing/checkout/credits` - Buy credits
- `GET /api/billing/balance` - Check balance

### Models
- `GET /api/models` - Browse models
- `GET /api/models/featured` - Featured models

---

## 🔌 GPU Providers

| Provider | Status | Features |
|----------|--------|----------|
| **Local** | ✅ Active | Veron 1 (RTX 5090) |
| **Vast.ai** | ✅ Ready | GPU marketplace |
| **RunPod** | ✅ Ready | Serverless + pods |
| **Lambda** | ⏳ Planned | Enterprise GPUs |

---

## 📚 Documentation

- [🧬 DNA Master Plan](./DNA-MASTER-PLAN.md) — The complete blueprint
- [🚀 Deployment Guide](./DEPLOYMENT.md) — How to deploy
- [📖 API Reference](./docs/api-reference.md) — API documentation

---

## 🛠️ Tech Stack

**Backend:**
- Express.js + TypeScript
- Prisma ORM + PostgreSQL
- Stripe for payments
- Redis for caching

**Frontend:**
- Next.js 14 (App Router)
- Tailwind CSS
- React Hooks

**Infrastructure:**
- Docker + Docker Compose
- Nginx reverse proxy
- Multi-provider GPU orchestration

---

## 📄 License

MIT License. See [LICENSE](./LICENSE).

---

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines first.

---

*Built with 💪 by Grant & Kit Zero*

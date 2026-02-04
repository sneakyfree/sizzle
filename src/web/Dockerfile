# Sizzle Web - Dockerfile
# Multi-stage build for optimized Next.js production image

# Dependencies stage
FROM node:20-alpine AS deps

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Set environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy only what's needed
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000 || exit 1

# Expose port
EXPOSE 3000

# Start
CMD ["node", "server.js"]

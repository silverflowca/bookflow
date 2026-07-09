# BookFlow - Multi-stage Docker Build
# Stage 1: Build the React client
FROM node:20-alpine AS client-builder

WORKDIR /app/client

# Build arguments for Vite (baked into the JS bundle at build time, not secret at runtime)
ARG VITE_API_URL=/api
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Expose to the build environment so Vite can inline them into the JS bundle.
# These are public anon keys baked into client JS — not server-side secrets.
# hadolint ignore=DL3044
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}

# Copy client package files
COPY client/package*.json ./

# Install dependencies
RUN npm ci

# Copy client source
COPY client/ ./

# Build the client (outputs to dist/)
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init + Chromium (layer-cached — only rebuilds when Dockerfile changes)
RUN apk add --no-cache dumb-init chromium nss freetype harfbuzz ca-certificates ttf-freefont

ENV CHROMIUM_PATH=/usr/bin/chromium-browser

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy server package files
COPY server/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy server source
COPY server/ ./

# Copy built client from previous stage
COPY --from=client-builder /app/client/dist ./public

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (configurable via PORT env var)
EXPOSE 8682

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-8682}/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["node", "server.js"]

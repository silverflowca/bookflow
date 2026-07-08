FROM ghcr.io/puppeteer/puppeteer:22

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (puppeteer will skip Chrome download — base image has it)
RUN npm ci --only=production

# Copy server
COPY server.js ./

EXPOSE 3099

CMD ["node", "server.js"]

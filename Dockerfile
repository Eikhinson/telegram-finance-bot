# Base image
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies (including devDependencies for tsc)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
# We use npm run build which calls mastra build
RUN npm run build

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

# Copy package files for production install
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Copy database schema if needed (though we use managed Neon DB)
# COPY src/db/schema.ts ./src/db/

# Set environment variable for production
ENV NODE_ENV=production

# Start the bot
CMD ["node", "dist/index.js"]

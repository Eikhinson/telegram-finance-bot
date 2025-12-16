# Base image
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies (including devDependencies for mastra build)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application using Mastra
RUN npm run build

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

# Copy the entire Mastra output (it includes dependencies)
COPY --from=builder /app/.mastra/output ./.mastra/output

# Set environment variable for production
ENV NODE_ENV=production

# Start the bot using Mastra's output
CMD ["node", "--import=./.mastra/output/instrumentation.mjs", ".mastra/output/index.mjs"]

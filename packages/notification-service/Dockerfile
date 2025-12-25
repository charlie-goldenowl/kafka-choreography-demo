FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package*.json ./
COPY packages/shared ./packages/shared
COPY packages/notification-service ./packages/notification-service

# Install dependencies
RUN npm install

# Build shared package
WORKDIR /app/packages/shared
RUN npm run build

# Build notification service
WORKDIR /app/packages/notification-service
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/notification-service/dist ./dist
COPY --from=builder /app/packages/notification-service/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3004

CMD ["node", "dist/index.js"]


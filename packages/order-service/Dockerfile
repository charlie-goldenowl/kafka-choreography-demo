FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package*.json ./
COPY packages/shared ./packages/shared
COPY packages/order-service ./packages/order-service

# Install dependencies
RUN npm install

# Build shared package
WORKDIR /app/packages/shared
RUN npm run build

# Build order service
WORKDIR /app/packages/order-service
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/order-service/dist ./dist
COPY --from=builder /app/packages/order-service/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

CMD ["node", "dist/index.js"]


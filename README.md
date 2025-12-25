# Kafka Choreography Demo - Microservices with Event-Driven Architecture

A microservices system using Kafka Choreography Pattern to handle order processing and payment flows, with automatic compensation (rollback) on errors.

## 🏗️ Architecture

This project uses **Choreography Pattern** to ensure data consistency in a microservices environment with **Eventually Consistent**:

1. **Order Service** → Creates orders and coordinates workflow
2. **Inventory Service** → Manages inventory, reserve/release
3. **Payment Service** → Processes payments and refunds
4. **Notification Service** → Sends email notifications

Each service is independent, communicating via Kafka events, with no central orchestrator.

### 📊 Event Flow (Success Path)

```
Order Service          Inventory Service      Payment Service      Notification Service
     │                        │                      │                      │
     ├─ order.created ────────┼──────────────────────┼──────────────────────┤
     │                        │                      │                      │
     ├─ inventory.reserve ────>                      │                      │
     │   .requested           │                      │                      │
     │                        │                      │                      │
     │ <─ inventory.reserved ──┤                      │                      │
     │                        │                      │                      │
     ├─ payment.process ────────────────────────────>│                      │
     │   .requested            │                      │                      │
     │                        │                      │                      │
     │ <─ payment.processed ─────────────────────────┤                      │
     │                        │                      │                      │
     ├─ order.confirmed ───────┼──────────────────────┼──────────────────────┤
     │                        │                      │                      │
     ├─ notification.send ────────────────────────────┼─────────────────────>│
     │   .requested            │                      │                      │
     │                        │                      │                      │
     │ <─ notification.sent ───────────────────────────┼──────────────────────┤
```

### ❌ Event Flow (Failure Path - Compensation)

```
Order Service          Inventory Service      Payment Service      Notification Service
     │                        │                      │                      │
     ├─ order.created ────────┼──────────────────────┼──────────────────────┤
     │                        │                      │                      │
     ├─ inventory.reserve ────>                      │                      │
     │   .requested           │                      │                      │
     │                        │                      │                      │
     │ <─ inventory.reserved ──┤                      │                      │
     │                        │                      │                      │
     ├─ payment.process ────────────────────────────>│                      │
     │   .requested            │                      │                      │
     │                        │                      │                      │
     │ <─ payment.failed ────────────────────────────┤                      │
     │                        │                      │                      │
     ├─ order.cancelled ───────┼──────────────────────┼──────────────────────┤
     │                        │                      │                      │
     ├─ inventory.release ────>                      │                      │
     │   .requested            │                      │                      │
     │                        │                      │                      │
     │ <─ inventory.released ──┤                      │                      │
     │                        │                      │                      │
     ├─ payment.refund ──────────────────────────────>│                      │
     │   .requested            │                      │                      │
     │                        │                      │                      │
     │ <─ payment.refunded ───────────────────────────┤                      │
     │                        │                      │                      │
     ├─ notification.send ────────────────────────────┼─────────────────────>│
     │   .requested            │                      │                      │
```

## 📋 Requirements

- Docker and Docker Compose
- Node.js 20+
- npm or yarn

## 🚀 Installation and Running

### 1. Start Kafka Infrastructure

```bash
docker compose up -d zookeeper kafka kafka-ui
```

This will start:
- **Zookeeper** (port 2181) - Manages Kafka cluster
- **Kafka Broker** (port 9092) - Message broker
- **Kafka UI** (port 8080) - Dashboard to view topics and messages

Check Kafka UI at: http://localhost:8080

### 2. Install Dependencies

```bash
npm install
```

### 3. Build Services

```bash
npm run build
```

### 4. Run Services (Development)

**Run each service separately:**

```bash
# Terminal 1: Order Service
npm run dev:order

# Terminal 2: Inventory Service
npm run dev:inventory

# Terminal 3: Payment Service
npm run dev:payment

# Terminal 4: Notification Service
npm run dev:notification
```

**Or run all services:**

```bash
npm run start:all
```

### 5. Run Client Test

In another terminal, run the client to test:

```bash
cd packages/client
npm install
npm run start
```

The client will automatically run 2 test cases:
- **Test Case 1**: Successful order (amount < 1000)
- **Test Case 2**: Failed order (amount > 1000) - will trigger compensation

## 🧪 Testing with cURL

### Step 1: Check Service Health

```bash
# Check all services are running
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
```

Expected response:
```json
{"status":"ok","service":"order-service"}
```

### Step 2: Test Case 1 - Successful Order (amount < 1000)

```bash
# Create a successful order
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-test-success",
    "userId": "user-123",
    "items": [
      {"itemId": "item-1", "name": "Product 1", "quantity": 2, "price": 100},
      {"itemId": "item-2", "name": "Product 2", "quantity": 1, "price": 200}
    ],
    "totalAmount": 400
  }'
```

Expected response:
```json
{"message":"Order created","orderId":"order-test-success"}
```

**Wait 5-8 seconds for processing, then check order status:**

```bash
# Check order status (should be "confirmed")
curl http://localhost:3001/orders/order-test-success
```

Expected response:
```json
{
  "orderId": "order-test-success",
  "userId": "user-123",
  "items": [...],
  "totalAmount": 400,
  "status": "confirmed",
  "createdAt": "2025-12-25T10:39:23.568Z",
  "confirmedAt": "2025-12-25T10:39:25.334Z"
}
```

**Check inventory (should be reserved):**

```bash
curl http://localhost:3002/inventory
```

**Check payments (should have payment record):**

```bash
curl http://localhost:3003/payments
```

### Step 3: Test Case 2 - Failed Order with Compensation (amount > 1000)

```bash
# Create a failed order (will trigger compensation)
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-test-failed",
    "userId": "user-456",
    "items": [
      {"itemId": "item-1", "name": "Product 1", "quantity": 5, "price": 300},
      {"itemId": "item-3", "name": "Product 3", "quantity": 3, "price": 400}
    ],
    "totalAmount": 2700
  }'
```

**Wait 5-8 seconds for processing and compensation, then check order status:**

```bash
# Check order status (should be "cancelled")
curl http://localhost:3001/orders/order-test-failed
```

Expected response:
```json
{
  "orderId": "order-test-failed",
  "userId": "user-456",
  "items": [...],
  "totalAmount": 2700,
  "status": "cancelled",
  "createdAt": "2025-12-25T10:37:50.333Z",
  "cancelledAt": "2025-12-25T10:37:51.815Z"
}
```

**Verify compensation:**
- Inventory should be released (check inventory endpoint)
- No payment should be created (check payments endpoint)

### Step 4: View All Orders

```bash
# Get all orders
curl http://localhost:3001/orders
```

### Step 5: View Events in Kafka UI

1. Open browser: http://localhost:8080
2. Select cluster: **local**
3. Navigate to **Topics** tab
4. View topics:
   - `order-events`
   - `inventory-events`
   - `payment-events`
   - `notification-events`
5. Click on a topic → **Messages** tab to see events in real-time

## 📊 View Events on Kafka UI

### Quick Access

1. Open browser and navigate to: http://localhost:8080
2. Select cluster: **local**
3. View topics in **Topics** tab:
   - `order-events`
   - `inventory-events`
   - `payment-events`
   - `notification-events`

### View Messages

1. Select a topic (e.g., `order-events`)
2. Click on **Messages** tab
3. View events published in real-time
4. Click on a message to see detailed JSON

### Filter Messages

- Filter by key (orderId)
- Filter by headers (eventType, userId)
- View consumer groups and lag

## 🔍 Project Structure

```
kafka-choreography-demo/
├── docker-compose.yml          # Docker compose for Kafka and services
├── package.json                # Workspace root
├── tsconfig.json               # TypeScript configuration
├── biome.json                  # Linter/Formatter config
├── packages/
│   ├── shared/                 # Shared types and events
│   │   ├── src/
│   │   │   ├── types/          # Type definitions
│   │   │   └── events/         # Event definitions
│   │   └── package.json
│   ├── order-service/          # Order Service
│   │   ├── src/
│   │   │   ├── handlers/       # Event handlers
│   │   │   ├── kafka/          # Kafka client, publisher, subscriber
│   │   │   ├── storage/         # In-memory store
│   │   │   ├── api/            # HTTP server
│   │   │   └── index.ts
│   │   └── Dockerfile
│   ├── inventory-service/      # Inventory Service
│   ├── payment-service/        # Payment Service
│   ├── notification-service/  # Notification Service
│   └── client/                 # Test client
└── README.md
```

## 🎯 Workflow Logic

### 📊 Success Flow (Happy Path)

1. **Create Order** → Order Service creates order, publishes `order.created`
2. **Reserve Inventory** → Inventory Service reserves, publishes `inventory.reserved`
3. **Process Payment** → Payment Service processes, publishes `payment.processed`
4. **Confirm Order** → Order Service confirms, publishes `order.confirmed`
5. **Send Notification** → Notification Service sends email, publishes `notification.sent`

### ❌ Failure Flow (Compensation - Choreography Pattern)

When payment fails:
1. **Payment Failed** → Payment Service publishes `payment.failed`
2. **Cancel Order** → Order Service cancels, publishes `order.cancelled`
3. **Release Inventory** → Inventory Service releases, publishes `inventory.released`
4. **Refund Payment** → Payment Service refunds (if payment was processed), publishes `payment.refunded`
5. **Send Cancellation Email** → Notification Service sends cancellation email

### 🔄 Choreography Pattern Explanation

**Choreography Pattern** ensures data consistency in distributed systems:

1. **No Orchestrator**: Each service decides its actions based on received events
2. **Eventually Consistent**: Services may not sync immediately, but will eventually be consistent
3. **Idempotency**: Each event handler can be safely retried
4. **Durability**: Kafka ensures all events are stored and can be replayed

### 📋 Event Types

| Event | Publisher | Subscriber | Description |
|-------|-----------|------------|-------------|
| `order.created` | Order Service | Inventory Service | Order created |
| `inventory.reserve.requested` | Order Service | Inventory Service | Request to reserve inventory |
| `inventory.reserved` | Inventory Service | Order Service, Payment Service | Inventory reserved |
| `inventory.reservation.failed` | Inventory Service | Order Service | Inventory reservation failed |
| `payment.process.requested` | Order Service | Payment Service | Request to process payment |
| `payment.processed` | Payment Service | Order Service, Notification Service | Payment successful |
| `payment.failed` | Payment Service | Order Service, Inventory Service | Payment failed |
| `order.confirmed` | Order Service | Notification Service | Order confirmed |
| `order.cancelled` | Order Service | Inventory Service, Payment Service | Order cancelled |
| `inventory.release.requested` | Order Service | Inventory Service | Request to release inventory |
| `inventory.released` | Inventory Service | (monitoring) | Inventory released |
| `payment.refund.requested` | Order Service | Payment Service | Request to refund |
| `payment.refunded` | Payment Service | (monitoring) | Payment refunded |
| `notification.send.requested` | Order Service | Notification Service | Request to send notification |
| `notification.sent` | Notification Service | (monitoring) | Notification sent |

## 🧪 Test Cases

### Test Case 1: Success

```json
{
  "orderId": "order-xxx-1",
  "userId": "user-123",
  "items": [
    { "itemId": "item-1", "name": "Product 1", "quantity": 2, "price": 100 },
    { "itemId": "item-2", "name": "Product 2", "quantity": 1, "price": 200 }
  ],
  "totalAmount": 400
}
```

Result: Order processed successfully, inventory reserved, payment processed, email sent.

### Test Case 2: Failure (Compensation)

```json
{
  "orderId": "order-xxx-2",
  "userId": "user-456",
  "items": [
    { "itemId": "item-1", "name": "Product 1", "quantity": 5, "price": 300 },
    { "itemId": "item-3", "name": "Product 3", "quantity": 3, "price": 400 }
  ],
  "totalAmount": 2700
}
```

Result: Payment failed (amount > 1000), order cancelled, inventory released, refund processed (if any), cancellation email sent.

## 📝 Logs

Services will log detailed steps:
- 🚀 Service started
- 📝 Order created
- 📦 Inventory reserved/released
- 💳 Payment processed/refunded
- 📧 Email sent
- 🔄 Compensation steps (if any)
- ✅❌ Final result

## ⚡ Performance & Scaling

### Service Scaling

**Can scale each service independently:**

```bash
# Scale order service
docker-compose up -d --scale order-service=3

# Scale payment service
docker-compose up -d --scale payment-service=2
```

### Kafka Consumer Groups

Each service has its own consumer group, allowing:
- **Parallel Processing**: Multiple instances of the same service can process messages in parallel
- **Load Balancing**: Kafka automatically distributes messages among consumers in the same group
- **Fault Tolerance**: If one instance fails, other instances continue processing

### Best Practices

1. **Idempotency**: All event handlers are idempotent
2. **Error Handling**: Implement dead letter queue for failed messages
3. **Monitoring**: Use Kafka UI to monitor topics and consumer lag
4. **Event Sourcing**: Can store events for replay or audit

## 🔧 Development

### Linting & Formatting

```bash
# Lint all packages
npm run lint

# Fix linting errors
npm run lint:fix

# Format code
npm run format

# Type check
npm run typecheck
```

### API Endpoints

**Kafka UI** (http://localhost:8080):
- Dashboard to view Kafka topics, messages, and consumer groups
- Real-time event monitoring
- Message filtering and search

**Order Service** (http://localhost:3001):
- `GET /health` - Health check
- `GET /orders` - Get all orders
- `GET /orders/:orderId` - Get order by ID
- `POST /orders` - Create new order

**Inventory Service** (http://localhost:3002):
- `GET /health` - Health check
- `GET /inventory` - Get all inventory
- `GET /inventory/:itemId` - Get inventory by ID

**Payment Service** (http://localhost:3003):
- `GET /health` - Health check
- `GET /payments` - Get all payments
- `GET /payments/:paymentId` - Get payment by ID
- `GET /payments/order/:orderId` - Get payment by order ID

**Notification Service** (http://localhost:3004):
- `GET /health` - Health check

## 🆚 Comparison with Temporal Orchestration

| Aspect | Temporal Orchestration | Kafka Choreography |
|--------|------------------------|-------------------|
| **Pattern** | Orchestration (centralized) | Choreography (decentralized) |
| **Consistency** | Strong consistency | Eventually consistent |
| **Orchestrator** | Yes (Temporal workflow) | No (each service decides) |
| **Complexity** | Simpler (clear workflow) | More complex (must understand event flow) |
| **Scalability** | Depends on Temporal | Easy to scale (stateless services) |
| **Debugging** | Easier (has Temporal UI) | Harder (must trace events) |
| **Failure Handling** | Automatic retry and compensation | Must implement retry logic |

## 📚 References

- [Kafka Documentation](https://kafka.apache.org/documentation/)
- [Event-Driven Architecture](https://martinfowler.com/articles/201701-event-driven.html)
- [Choreography vs Orchestration](https://www.oreilly.com/library/view/building-microservices/9781491950340/ch04.html)
- [Microservices Patterns](https://microservices.io/patterns/index.html)

## 📄 License

MIT

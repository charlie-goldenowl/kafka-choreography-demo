# Tại sao cần thêm `withSpan`?

## Vấn đề: OpenTelemetry không tự động trace mọi thứ

OpenTelemetry **KHÔNG** tự động trace business logic của bạn. Nó chỉ tự động instrument một số thư viện phổ biến nếu bạn cài đặt auto-instrumentation packages.

### 1. **Business Logic không tự động trace**

```typescript
// ❌ KHÔNG tự động trace
export async function createOrder(orderData: OrderData): Promise<void> {
  // Business logic này không được trace tự động
  const order = { ... };
  orderStore.create(order);
  await publishEvent(event);
}
```

OpenTelemetry không biết function `createOrder` là gì, nó chỉ là code JavaScript/TypeScript bình thường.

### 2. **Native Node.js HTTP Server**

```typescript
// ❌ Native HTTP server không tự động trace
const server = createServer(async (req, res) => {
  // Không có span tự động
  await createOrder(orderData);
});
```

Nếu bạn dùng Express/Fastify, có thể dùng auto-instrumentation. Nhưng với native `http` module, cần manual instrumentation.

### 3. **KafkaJS**

```typescript
// ❌ KafkaJS không tự động trace
await consumer.run({
  eachMessage: async ({ message }) => {
    // Không có span tự động
    const event = JSON.parse(message.value.toString());
  }
});
```

KafkaJS không có built-in OpenTelemetry support, cần manual instrumentation.

## Giải pháp: Manual Instrumentation với `withSpan`

```typescript
// ✅ Có trace
export async function createOrder(orderData: OrderData): Promise<void> {
  return withSpan('order-service', 'createOrder', async (span) => {
    // Bây giờ có span "createOrder" trong Jaeger
    if (span) {
      span.setAttributes({
        'order.id': orderData.orderId,
        'order.total_amount': orderData.totalAmount,
      });
    }
    
    const order = { ... };
    orderStore.create(order);
    await publishEvent(event);
  });
}
```

### `withSpan` làm gì?

1. **Tạo span**: Tạo một span mới với tên "createOrder"
2. **Track context**: Giữ context để link các spans lại với nhau
3. **Error handling**: Tự động mark span là ERROR nếu có exception
4. **Cleanup**: Tự động end span sau khi function hoàn thành

## Có cách nào tự động không?

### Option 1: Auto-instrumentation (một phần)

Có thể dùng `@opentelemetry/auto-instrumentations-node` để tự động trace:
- HTTP requests (Express, Fastify, etc.)
- Database queries
- gRPC calls

**Nhưng vẫn cần `withSpan` cho:**
- Business logic functions
- Kafka consumers/producers
- Custom operations

### Option 2: Decorators/Middleware (nếu dùng framework)

Nếu dùng Express/Fastify, có thể tạo middleware tự động:

```typescript
// Express middleware tự động trace routes
app.use((req, res, next) => {
  withSpan('order-service', `http.${req.method}.${req.path}`, async (span) => {
    // Auto trace
    next();
  });
});
```

### Option 3: AOP (Aspect-Oriented Programming)

Có thể dùng decorators hoặc proxies để tự động wrap functions, nhưng phức tạp hơn.

## Kết luận

**Phải thêm `withSpan` vì:**

1. ✅ **Business logic cần manual instrumentation** - OpenTelemetry không biết đâu là function quan trọng
2. ✅ **Native Node.js modules** - Không có auto-instrumentation
3. ✅ **Custom operations** - Kafka, custom logic, etc.
4. ✅ **Control và flexibility** - Bạn muốn trace cái gì, khi nào, với attributes gì

**Có thể tự động hóa một phần** bằng auto-instrumentation, nhưng vẫn cần `withSpan` cho business logic quan trọng.

## Best Practice

- ✅ Dùng `withSpan` cho **business logic quan trọng** (createOrder, handlePayment, etc.)
- ✅ Dùng `withSpan` cho **Kafka consumers/producers**
- ✅ Dùng auto-instrumentation cho **HTTP frameworks** (nếu có)
- ✅ Thêm **attributes** để dễ debug (order.id, user.id, etc.)


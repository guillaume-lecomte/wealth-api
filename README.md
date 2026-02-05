# Wealth Tracker API

A prototype backend service for tracking user financial wealth from heterogeneous financial events (banks, crypto, insurance, etc.).

This project demonstrates event processing, normalization, and reconciliation logic for handling incomplete, contradictory, delayed, or duplicate events.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.0-red.svg)](https://nestjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green.svg)](https://www.mongodb.com/)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Testing](#testing)
- [Roadmap](#roadmap)

---

## Features

- **Multi-source event ingestion** - Process events from banks, crypto platforms, and insurance providers
- **Idempotency** - Automatic duplicate detection and handling
- **Smart reconciliation** - Handle contradictory events with adjustment events for full audit trail
- **Late event handling** - Process delayed events with correct temporal ordering
- **Consolidated timeline** - Unified view across all financial accounts
- **Real-time balance calculation** - Aggregate balances across providers and accounts

---

## Architecture

### Tech Stack

- **Backend Framework**: NestJS (TypeScript)
- **Database**: MongoDB (native driver)
- **Validation**: class-validator / class-transformer
- **Configuration**: Environment variables (.env)

### Project Structure

```
src/
├── main.ts                    # Application bootstrap
├── app.module.ts              # Root module
├── common/
│   └── mongo.provider.ts      # MongoDB connection provider
└── wealth/
    ├── wealth.module.ts       # Wealth domain module
    ├── wealth.controller.ts   # HTTP routes
    ├── wealth.service.ts      # Business logic
    ├── enums/                 # Domain enums
    │   ├── provider.enum.ts
    │   ├── transaction-type.enum.ts
    │   ├── event-status.enum.ts
    │   └── event-origin.enum.ts
    └── dto/                   # Data transfer objects
        ├── bank-event.dto.ts
        ├── crypto-event.dto.ts
        ├── insurance-event.dto.ts
        ├── normalized-event.dto.ts
        ├── global-balance.dto.ts
        ├── account-balance.dto.ts
        └── timeline-event.dto.ts
```

### Key Components

**`main.ts`**  
Bootstraps NestJS application, configures CORS, enables global DTO validation.

**`app.module.ts`**  
Root module that loads configuration and the `WealthModule`.

**`mongo.provider.ts`**  
Encapsulates MongoDB connection, exposes injectable `Db` instance with lifecycle management.

**`wealth/`**  
Core domain module containing:
- Controller: HTTP endpoints (`/api/*`)
- Service: Normalization, idempotency, reconciliation, and aggregation logic
- DTOs: Input (webhook payloads), internal models, and output formats

---

## Getting Started

### Prerequisites

- Node.js >= 18
- MongoDB (local or remote)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone git@github.com:guillaume-lecomte/wealth-api.git
cd wealth-api

# Install dependencies
npm install
# or
yarn install

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Database Setup

```bash
# Start MongoDB with Docker Compose
docker-compose up -d
```

### Development

```bash
# Start development server
npm run start:dev
# or
yarn start:dev
```

The API will be available at `http://localhost:3000`.

---

## API Reference

### Webhook Endpoints (Event Ingestion)

#### 1. Bank Events

**POST** `/api/webhooks/bank`

Process banking transactions (credits, debits, transfers).

**Request Body:**
```json
{
  "userId": "user-001",
  "bankId": "BNP",
  "txnId": "TXN-123",
  "date": "2025-01-01T10:15:00Z",
  "type": "credit",
  "amount": 1500.5,
  "currency": "EUR",
  "account": "FR761234567890",
  "description": "January salary"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/webhooks/bank \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-001",
    "bankId": "BNP",
    "txnId": "TXN-123",
    "date": "2025-01-01T10:15:00Z",
    "type": "credit",
    "amount": 1500.5,
    "currency": "EUR",
    "account": "FR761234567890",
    "description": "January salary"
  }'
```

---

#### 2. Crypto Events

**POST** `/api/webhooks/crypto`

Process cryptocurrency transactions (deposits, withdrawals).

**Request Body:**
```json
{
  "userId": "user-001",
  "platform": "Coinbase",
  "id": "ORDER-789",
  "time": 1735900000000,
  "type": "deposit",
  "asset": "BTC",
  "amount": 0.01,
  "fiatValue": 400,
  "currency": "EUR",
  "walletId": "wallet-abc"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/webhooks/crypto \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-001",
    "platform": "Coinbase",
    "id": "ORDER-789",
    "time": 1735900000000,
    "type": "deposit",
    "asset": "BTC",
    "amount": 0.01,
    "fiatValue": 400,
    "currency": "EUR",
    "walletId": "wallet-abc"
  }'
```

---

#### 3. Insurance Events

**POST** `/api/webhooks/insurance`

Process insurance transactions (premiums, payouts).

**Request Body:**
```json
{
  "userId": "user-001",
  "insurer": "AXA",
  "transactionId": "AXA-456",
  "timestamp": 1735905000000,
  "movementType": "premium",
  "amount": 100,
  "currency": "EUR",
  "policyNumber": "POLICY-001"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/webhooks/insurance \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-001",
    "insurer": "AXA",
    "transactionId": "AXA-456",
    "timestamp": 1735905000000,
    "movementType": "premium",
    "amount": 100,
    "currency": "EUR",
    "policyNumber": "POLICY-001"
  }'
```

---

#### Webhook Response Formats

**New Event:**
```json
{
  "status": "success",
  "message": "Event processed",
  "transactionId": "BNP-TXN-123"
}
```

**Duplicate Event:**
```json
{
  "status": "duplicate",
  "message": "Event already processed with same effect",
  "transactionId": "BNP-TXN-123"
}
```

**Contradictory Event (Adjusted):**
```json
{
  "status": "adjusted",
  "message": "Contradictory event reconciled via adjustment",
  "transactionId": "BNP-TXN-123"
}
```

---

### Query Endpoints (Wealth Data)

#### 1. Global Balance

**GET** `/api/wealth/balance`

Retrieve consolidated balance across all accounts.

**Query Parameters:**
- `userId` (optional, default: `user-001`)

**Example:**
```bash
curl "http://localhost:3000/api/wealth/balance?userId=user-001"
```

**Response:**
```json
{
  "totalBalanceEUR": 1800.5,
  "accountCount": 3,
  "totalTransactions": 10,
  "accounts": [
    {
      "accountId": "FR761234567890",
      "provider": "bank",
      "providerId": "BNP",
      "balance": 1500.5,
      "currency": "EUR",
      "transactionCount": 5
    },
    {
      "accountId": "wallet-abc",
      "provider": "crypto",
      "providerId": "Coinbase",
      "balance": 400,
      "currency": "EUR",
      "transactionCount": 3
    }
  ]
}
```

---

#### 2. Account Details

**GET** `/api/wealth/accounts`

List all accounts with their balances.

**Query Parameters:**
- `userId` (optional, default: `user-001`)

**Example:**
```bash
curl "http://localhost:3000/api/wealth/accounts?userId=user-001"
```

**Response:**  
Array of `AccountBalanceDto` objects (same format as `accounts` array in global balance).

---

#### 3. Transaction Timeline

**GET** `/api/wealth/timeline`

Retrieve chronological transaction history across all providers.

**Query Parameters:**
- `userId` (optional, default: `user-001`)
- `limit` (optional, default: `100`)

**Example:**
```bash
curl "http://localhost:3000/api/wealth/timeline?userId=user-001&limit=50"
```

**Response:**
```json
[
  {
    "transactionId": "BNP-TXN-123",
    "timestamp": "2025-01-01T10:15:00.000Z",
    "provider": "bank",
    "providerId": "BNP",
    "accountId": "FR761234567890",
    "transactionType": "credit",
    "amount": 1500.5,
    "currency": "EUR",
    "description": "January salary"
  },
  {
    "transactionId": "Coinbase-ORDER-789",
    "timestamp": "2025-01-03T12:00:00.000Z",
    "provider": "crypto",
    "providerId": "Coinbase",
    "accountId": "wallet-abc",
    "transactionType": "deposit",
    "amount": 400,
    "currency": "EUR",
    "description": "deposit - 0.01 BTC"
  }
]
```

---

## Data Model

### NormalizedEvent Collection

All events (external and internal adjustments) are stored in the `normalized_events` collection.

**Key Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | User identifier |
| `provider` | enum | `bank`, `crypto`, or `insurance` |
| `providerId` | string | Provider identifier (e.g., `BNP`, `Coinbase`, `AXA`) |
| `transactionId` | string | Stable business identifier from provider |
| `timestamp` | Date | Effective transaction date (used for timeline ordering) |
| `transactionType` | enum | `credit`, `debit`, `deposit`, `withdrawal`, `premium` |
| `amount` | number | Signed amount (positive: inflow, negative: outflow) |
| `currency` | string | Currency code (default: `EUR`) |
| `accountId` | string | External account identifier (IBAN, wallet, policy number) |
| `description` | string | Human-readable description |
| `rawData` | object | Original webhook payload |
| `createdAt` | Date | Event ingestion timestamp |
| `status` | enum | `pending`, `settled`, `rejected` (prototype uses mostly `settled`) |
| `origin` | enum | `external` (received event) or `adjustment` (internal correction) |
| `groupKey` | string | Logical grouping key: `provider:providerId:accountId:currency` |

---

### Idempotency & Reconciliation

**Idempotency**  
Events are uniquely identified by `(userId, provider, transactionId)`.
- Duplicate events with identical content are ignored.
- Response: `{ status: "duplicate" }`

**Contradiction Handling**  
When a new event arrives with the same key but different content (modified amount or type):
- The original event remains unchanged (audit trail).
- An **adjustment event** (`origin = adjustment`) is created to compensate for the difference.
- Response: `{ status: "adjusted" }`

**Late Events**  
The `timestamp` field contains the business transaction date, enabling:
- Correct temporal ordering in timelines
- Proper aggregation even for delayed events
- Historical accuracy of balances

---

## Testing

### Postman Collection

1. Create a new collection: `Wealth Tracker API`
2. Add the following requests:
   - `POST {{baseUrl}}/api/webhooks/bank`
   - `POST {{baseUrl}}/api/webhooks/crypto`
   - `POST {{baseUrl}}/api/webhooks/insurance`
   - `GET {{baseUrl}}/api/wealth/balance`
   - `GET {{baseUrl}}/api/wealth/accounts`
   - `GET {{baseUrl}}/api/wealth/timeline`
3. Create an environment variable: `baseUrl = http://localhost:3000`
4. Use `{{baseUrl}}` in all request URLs

### Example Test Scenario

```bash
# 1. Create a bank credit
curl -X POST http://localhost:3000/api/webhooks/bank \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-001","bankId":"BNP","txnId":"TXN-001","date":"2025-01-01T10:00:00Z","type":"credit","amount":1000,"currency":"EUR","account":"FR76123","description":"Initial deposit"}'

# 2. Add crypto deposit
curl -X POST http://localhost:3000/api/webhooks/crypto \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-001","platform":"Coinbase","id":"ORDER-001","time":1735905600000,"type":"deposit","asset":"BTC","amount":0.01,"fiatValue":400,"currency":"EUR","walletId":"wallet-001"}'

# 3. Check balance
curl "http://localhost:3000/api/wealth/balance?userId=user-001"

# 4. View timeline
curl "http://localhost:3000/api/wealth/timeline?userId=user-001"
```

---

## Roadmap

### Current Limitations

- **Event storage**: All events and adjustments are stored in a single `normalized_events` collection (no separate event store)
- **Concurrency**: No optimistic/pessimistic locking at account level (add-only + adjustments model is sufficient for prototype)
- **Frontend**: No UI implementation in this repository

### Future Enhancements

- [ ] Add `accounts_snapshot` collection with background recalculation for performance
- [ ] Implement `pending`/`settled` workflow for card payments (authorization vs. capture)
- [ ] Integrate event bus (Kafka, RabbitMQ) for scalability and decoupling
- [ ] Add comprehensive unit and integration tests
- [ ] Implement authentication and authorization
- [ ] Support multi-currency conversion with real-time rates
- [ ] Add webhooks for client notifications on balance changes
- [ ] Implement event replay and point-in-time balance queries
- [ ] Add monitoring and observability (metrics, tracing)

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## License

[MIT](LICENSE)

---

## Contact

For questions or feedback, please open an issue on GitHub.

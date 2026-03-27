# @orbitmem/relay

HTTP relay server for OrbitMem — authenticated vault access, data discovery, and snapshot archival.

## Install

```bash
npm install @orbitmem/relay
```

## Quick Start

```bash
# Development (hot reload)
PORT=3000 RELAY_MODE=mock bun run --hot src/index.ts

# Production
bun run dist/index.js
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `RELAY_MODE` | `mock` | `mock` (in-memory) or `live` (OrbitDB/IPFS) |

## API Endpoints

All routes are prefixed with `/v1`.

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/challenge` | No | Generate nonce + message for wallet signing |
| POST | `/auth/session` | ERC-8128 | Issue session token |

### Vault

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/vault/public/:address/keys` | No | List public keys |
| GET | `/vault/public/:address/:key` | No | Read public value |
| POST | `/vault/read` | ERC-8128 | Read encrypted value |
| POST | `/vault/write` | ERC-8128 | Write vault entry |
| POST | `/vault/delete` | ERC-8128 | Delete vault entry |
| POST | `/vault/keys` | ERC-8128 | List vault keys |
| POST | `/vault/sync` | ERC-8128 | Trigger vault sync |

### Discovery

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/data/stats` | No | Global data statistics |
| GET | `/data/user/stats` | ERC-8128 | Per-user statistics |
| GET | `/data/search` | No | Search data registrations |
| GET | `/data/:dataId/score` | No | Get data quality score |

### Snapshots

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/snapshots` | ERC-8128 | List snapshots |
| POST | `/snapshots/archive` | ERC-8128 | Archive snapshot |
| GET | `/snapshots/usage` | ERC-8128 | Storage usage and limit |

## Authentication

The relay supports three authentication methods, checked in order:

1. **Bearer Session Token** — Stateless HMAC-SHA256 token (fastest)
   ```
   Authorization: Bearer <token>
   ```

2. **RFC 9421 Signature** — Standard HTTP message signatures with ERC-8128 verification

3. **Legacy X-OrbitMem Headers** — Backward-compatible signed requests
   ```
   X-OrbitMem-Signer: 0x...
   X-OrbitMem-Timestamp: 1234567890
   X-OrbitMem-Nonce: unique-id
   X-OrbitMem-Signature: 0x...
   ```

## Programmatic Usage

```typescript
import { createApp } from "@orbitmem/relay/app";
import { createMockServices } from "@orbitmem/relay/services";

const services = createMockServices();
const app = createApp(services);

// Use with any Hono-compatible runtime
export default app;
```

## License

MIT

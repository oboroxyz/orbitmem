# OrbitMem Memo App

A decentralized, encrypted memo app built with the OrbitMem SDK. Create, edit, and share private or public memos — all encrypted client-side with wallet-based authentication.

## Features

- **End-to-end encryption** — private memos encrypted with AES-256-GCM before leaving the browser
- **Wallet authentication** — ERC-8128 signed requests via MetaMask, WalletConnect, or Porto passkeys
- **Public sharing** — toggle memos to public and share links that anyone can view without a wallet
- **Markdown editor** — live preview with GitHub Flavored Markdown support

## Tech Stack

React 19 · Vite · TailwindCSS · wagmi · viem · @orbitmem/sdk

## Quick Start

1. **Set up environment variables:**

   ```bash
   cp .env.example .env
   ```

   The default relay is `https://orbitmem-relay.fly.dev`. To use a local relay, set `VITE_RELAY_URL=http://localhost:3000` and run `bun run dev:relay` from the monorepo root.

2. **Install dependencies and start the dev server:**

   ```bash
   (bun|pnpm|npm) install
   (bun|pnpm|npm) run dev
   ```

3. Open `http://localhost:5174`, connect your wallet, and start writing memos.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_RELAY_URL` | `https://orbitmem-relay.fly.dev` | OrbitMem relay server URL |
| `VITE_WALLETCONNECT_PROJECT_ID` | `orbitmem-memo-demo` | WalletConnect v2 project ID |

## Project Structure

```
src/
├── main.tsx                 # React root with wagmi + react-query providers
├── App.tsx                  # Client-side routing (list / edit / public view)
├── components/
│   ├── ConnectButton.tsx    # Wallet connection UI
│   ├── MemoList.tsx         # Memo list with edit / delete / share
│   ├── MemoEditor.tsx       # Markdown editor with visibility toggle
│   └── PublicMemoView.tsx   # Public memo view (no wallet required)
├── hooks/
│   └── useOrbitMem.ts       # Core hook: CRUD, encryption, key derivation
├── lib/
│   ├── wagmi.ts             # Wagmi config (Base Sepolia, connectors)
│   ├── relay.ts             # Relay API client
│   ├── erc8128.ts           # ERC-8128 request signing
│   └── encryption.ts        # AES encrypt/decrypt helpers
└── styles/
    └── index.css            # Tailwind imports
```

## How It Works

1. **Connect wallet** — user signs a deterministic message to derive an AES-256 encryption key
2. **Write memos** — each field (title, body, timestamps) is encrypted independently and stored on the relay vault at `memos/{id}/{field}`
3. **Toggle visibility** — public memos are stored unencrypted and accessible via `GET /v1/vault/public/:address/:key`
4. **Share** — public memos are viewable at `/:address/:memoId` without wallet connection

## Scripts

```bash
(bun|pnpm|npm) run dev
(bun|pnpm|npm) run build
(bun|pnpm|npm) run preview
(bun|pnpm|npm) run typecheck
```

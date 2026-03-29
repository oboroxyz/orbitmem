# OrbitMem — Presentation Script (3 min)

## Slide 1: Title (~10s)

Hi, I'm building OrbitMem — a decentralized data layer for the agentic web, designed for both humans and AI agents.

## Slide 2: Problem (~30s)

IPFS is great as decentralized storage — but it falls short as a modern, developer-friendly database.

No encryption — data is stored in the open. No authentication — anyone with a CID can access it. And no discovery — you can't search for data, and there's no quality signal.

So I'm building OrbitMem to fill these gaps.

## Slide 3: Architecture (~30s)

OrbitMem is built on OrbitDB — a local-first P2P database built on IPFS and libp2p.

On top of that, authentication uses Passkeys, EVM, and Solana wallets with ERC-8128 signed HTTP — no OAuth, no API keys. Encryption combines Lit Protocol for token-gated access with AES-256-GCM for per-record encryption. And discovery & trust is powered by ERC-8004. It was originally designed for agent reputation, but we applied it to data — on-chain scoring where every data entry is rated by humans and agents.

Snapshots are archived to Filecoin via Storacha for long-term persistence.

## Slide 4: Key Features

## Slide 5: Demo — Decentralized Memo (~40s)

To show how OrbitMem works as a decentralized database via SDK, here's a memo app. No server, no platform, no lock-in.

Connect with a Passkey(Porto) or EVM wallet. Write memos in Markdown with live preview.

Each memo has per-path visibility control. Public memos are shareable and can be registered on-chain. Private memos are AES-256-GCM encrypted — the relay server and IPFS nodes only receive already-encrypted data, so only the owner can decrypt it.

And you can snapshot your vault to Filecoin via Storacha for long-term backup.

## Slide 6: Demo — Agent Data Trust (~40s)

OrbitMem is also designed for agent use cases. We provide a CLI and agent skills so AI agents can publish, discover, and rate data autonomously. You can integrate it into your own agents — whether it's OpenClaw, WorkFlow, or any autonomous system.

Agent A stores research data and registers it on-chain — minting an ERC-721 receipt. Agent B discovers it by searching with schema and quality filters, then rates it with a score and tags like "accurate."

This creates a virtuous cycle — higher quality, higher visibility. Reputation-gated access via Lit Protocol means the best data producers earn more trust and reach.

## Slide 7: Closing + QR (~15s)

That's OrbitMem — encrypted vaults, on-chain discovery, and verifiable data trust. All open source.

Scan the QR codes to check it out. Thanks.

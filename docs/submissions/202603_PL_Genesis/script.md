# OrbitMem — Presentation Script (3 min)

## Slide 1: Title (~10s)

Hi, I'm building OrbitMem — a decentralized data layer for the agentic web, designed for both humans and AI agents.

## Slide 2: Problem (~30s)

IPFS is great as decentralized storage — but it's no modern usable database.

- _No encryption_ — data is stored in the open.
- _No authentication_ — anyone know a CID can access it.
- _No discovery_ — you can't search for data, and there's no quality signal.

So I'm building OrbitMem to fill these gaps.

## Slide 3: Architecture (~30s)

OrbitMem is built on top of OrbitDB. That has 4 layers.

- _Auth_: ERC-8128(eighty-one twenty-eight) signed HTTP — no token or API keys.
- _Encryption_: pairs Lit Protocol with AES.
- _Discovery_: ERC-8004(eighty-oh-four) — on-chain scoring where data entries are rated by humans and agents. we applied this to data not only agent.
- _Persistence_: handled by P2P replication across relay server. Snapshots are archived to Filecoin via Storacha.

## Slide 4: Key Features

## Slide 5: Demo — Decentralized Memo (~40s)

OrbitMem works as a decentralized database via SDK, here's a demo memo app deployed on IPFS.

--- _DEMO_1_ ---

- Auth with EOA wallet or passkey(porto)
- Public memos are shareable.
- Private memos are AES encrypted — the relay server and IPFS nodes only receive already-encrypted data, so only the owner can decrypt it.

## Slide 6: Demo — Agent Data Trust (~40s)

OrbitMem is also designed for agents. We provide a CLI and Skills so agents can publish, discover, and rate data autonomously.

--- _DEMO_2_ ---

You can integrate it into your own agents — whether it's OpenClaw, WorkFlow, or any agents.

Quality drives visibility. We also integrated Machine Payments Protocol by Tempo/Stpipe, so data can be bought and sold based on reputation. This drives a healthy data ecosystem.

## Slide 7: Closing + QR (~15s)

That's it. Thanks.

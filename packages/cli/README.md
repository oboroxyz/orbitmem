# orbitmem

CLI for OrbitMem — manage vaults, discover data, and interact with on-chain registries.

## Install

```bash
npm install -g orbitmem
```

## Quick Start

```bash
# Initialize (generate keys, create config)
orbitmem init --name my-wallet --network base-sepolia

# Store data
orbitmem vault store /notes/hello "Hello, world!"

# Read data
orbitmem vault get /notes/hello

# List keys
orbitmem vault ls

# Check status
orbitmem status
```

## Commands

### `init`

Generate an OWS wallet and create `~/.orbitmem/config.json`. Vault data is stored at `~/.orbitmem/vault/`.

If the OWS wallet already exists (e.g. after removing `~/.orbitmem/`), use `--force` to re-link it.

```bash
orbitmem init --name <wallet> --network <chain> [--force]
```

### `status`

Show identity, config, and vault info.

```bash
orbitmem status [--relay <url>] [--json]
```

### `vault store <path> <value>`

Store data in vault.

```bash
# Private (default, AES encrypted)
orbitmem vault store /secret "sensitive data"

# Public (plaintext)
orbitmem vault store /public/bio "Hello" --public

# Shared with Lit access conditions
orbitmem vault store /shared/data "gated info" \
  --shared --engine lit --allow-address 0x1234...

# Require minimum reputation score
orbitmem vault store /gated/data "quality data" \
  --shared --engine lit --min-score 100
```

### `vault get <path>`

Read data from vault.

```bash
orbitmem vault get /notes/hello [--relay <url>] [--json]
```

### `vault ls [prefix]`

List vault keys.

```bash
orbitmem vault ls
orbitmem vault ls /notes
```

### `vault update-access <path>`

Re-encrypt with new Lit access conditions.

```bash
orbitmem vault update-access /shared/data --allow-address 0xNewAddr...
```

### `vault price`

Manage per-read pricing (micropayments).

```bash
orbitmem vault price set /data 5.50          # Set price in USDC
orbitmem vault price set /data 2.00 --currency EUR
orbitmem vault price get /data               # Show price
orbitmem vault price ls                      # List priced paths
orbitmem vault price rm /data                # Remove pricing
```

### `register`

Register data on-chain for discovery (ERC-8004).

```bash
orbitmem register /my/data \
  --name "My Dataset" \
  --description "A useful dataset" \
  --schema json \
  --tags data,public
```

### `discover`

Search on-chain data registries.

```bash
orbitmem discover json --tags public --min-quality 80
```

### `rate`

Rate data quality on-chain via FeedbackRegistry (ERC-8004).

```bash
orbitmem rate 1 90 --tag accurate
orbitmem rate 1 85 --tag fresh --tag2 complete --json
```

### `snapshot`

Archive vault to Filecoin/IPFS via Storacha.

```bash
orbitmem snapshot --label "backup-2026-03"
```

### `dev`

Start local relay server for development.

```bash
orbitmem dev [--port 3000]
```

## Global Options

| Flag | Description |
|------|-------------|
| `--relay <url>` | Override relay URL |
| `--chain <name>` | Override blockchain |
| `--json` | Output as JSON |
| `--help` | Show help |

## License

MIT

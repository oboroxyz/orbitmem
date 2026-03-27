# @orbitmem/contracts

Solidity smart contracts for OrbitMem — on-chain data discovery and reputation (ERC-8004).

## Install

```bash
npm install @orbitmem/contracts
```

## Usage

```typescript
import {
  DataRegistryAbi,
  FeedbackRegistryAbi,
  DataRegistryBytecode,
  FeedbackRegistryBytecode,
} from "@orbitmem/contracts";

import { getContract } from "viem";

const dataRegistry = getContract({
  address: "0x9eE44938ED77227470CaA2DbCC0459F49d249B7A",
  abi: DataRegistryAbi,
  client: walletClient,
});

const feedbackRegistry = getContract({
  address: "0x1Bce77f90C33A5f8faCa54782Ce3a17d1AD7109a",
  abi: FeedbackRegistryAbi,
  client: walletClient,
});
```

## Deployed Addresses

| Contract         | Base  | Base Sepolia                                                                                                                    |
| ---------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| DataRegistry     | _TBD_ | [`0x9eE44938ED77227470CaA2DbCC0459F49d249B7A`](https://sepolia.basescan.org/address/0x9eE44938ED77227470CaA2DbCC0459F49d249B7A) |
| FeedbackRegistry | _TBD_ | [`0x1Bce77f90C33A5f8faCa54782Ce3a17d1AD7109a`](https://sepolia.basescan.org/address/0x1Bce77f90C33A5f8faCa54782Ce3a17d1AD7109a) |

## Contracts

### DataRegistry

ERC-721 registry where each token represents a registered data entry.

- `register(dataURI)` — Mint a new data entry NFT, returns `tokenId`
- `setDataURI(tokenId, dataURI)` — Update metadata URI (owner only)
- `setActive(tokenId, active)` — Toggle active/inactive status (owner only)
- `isActive(tokenId)` — Check if entry is active

### FeedbackRegistry

Registry-agnostic reputation system. Works with any ERC-721 registry, not just DataRegistry.

- `giveFeedback(registry, entityId, value, valueDecimals, tag1, tag2, feedbackURI, feedbackHash)` — Submit scored feedback with dual-tag categorization
- `revokeFeedback(registry, entityId, index)` — Revoke a feedback entry
- `getScore(registry, entityId)` — Get aggregated score (totalValue, count)
- `getTagScore(registry, entityId, tag)` — Get score for a specific tag
- `getFeedback(registry, entityId, client, index)` — Get individual feedback entry

```solidity
// Register data
uint256 dataId = dataRegistry.register("ipfs://my-data-metadata");

// Submit feedback
feedbackRegistry.giveFeedback(
    address(dataRegistry), dataId,
    90, 0,             // value: 90, decimals: 0
    "accurate", "",    // tags
    "", bytes32(0)     // optional URI and hash
);

// Query score
(int256 total, uint256 count) = feedbackRegistry.getScore(address(dataRegistry), dataId);
```

## Development

Requires [Foundry](https://book.getfoundry.sh/).

```bash
forge build              # Compile
forge test -vvv          # Run tests
forge test --gas-report  # Gas reporting
forge fmt                # Format
```

### Deploy

```bash
OWNER=<SAFE_ADDRESS> forge script script/Deploy.s.sol \
  --broadcast --rpc-url <RPC_URL> --private-key <KEY>
```

## License

MIT

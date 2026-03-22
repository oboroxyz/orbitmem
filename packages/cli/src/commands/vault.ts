import type {
  EncryptionEngine,
  EvmAddress,
  EvmChain,
  LitAccessCondition,
  LitEvmCondition,
  Visibility,
} from "@orbitmem/sdk/types";

import { loadConfig, loadKey } from "../config.js";
import { createClient, type LitNetwork } from "../utils/client.js";
import { error, output } from "../utils/output.js";

export async function vault(args: string[], flags: Record<string, string>): Promise<void> {
  const sub = args[0];
  switch (sub) {
    case "store":
      return vaultStore(args.slice(1), flags);
    case "get":
      return vaultGet(args.slice(1), flags);
    case "ls":
      return vaultLs(args.slice(1), flags);
    case "price":
      return vaultPrice(args.slice(1), flags);
    default:
      error(`Unknown vault command: ${sub ?? "(none)"}. Use: store, get, ls, price`);
  }
}

async function vaultStore(args: string[], flags: Record<string, string>): Promise<void> {
  const [path, ...valueParts] = args;
  const value = valueParts.join(" ");
  if (!path || !value) error("Usage: orbitmem vault store <path> <value>");

  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;

  const engine = (flags.engine as EncryptionEngine) ?? "aes";
  const litNetwork = (flags["lit-network"] as LitNetwork) ?? "cayenne";
  const useLit = engine === "lit";

  const client = await createClient(config, loadKey(), useLit ? { litNetwork } : undefined);

  try {
    let visibility: Visibility;
    if (flags.public !== undefined) {
      visibility = "public";
    } else if (flags.shared !== undefined || useLit) {
      visibility = "shared";
    } else {
      visibility = "private";
    }

    const putOpts: {
      visibility: Visibility;
      engine?: EncryptionEngine;
      accessConditions?: LitAccessCondition[];
    } = { visibility };

    if (useLit) {
      putOpts.engine = "lit";
      const accessConditions: LitAccessCondition[] = [];
      if (flags["allow-address"]) {
        const chain = (flags["access-chain"] ?? config.chain ?? "base-sepolia") as EvmChain;
        const condition: LitEvmCondition = {
          conditionType: "evmBasic",
          contractAddress: "" as EvmAddress,
          standardContractType: "",
          chain,
          method: "",
          parameters: [":userAddress"],
          returnValueTest: { comparator: "=", value: flags["allow-address"] },
        };
        accessConditions.push(condition);
      }
      if (flags["min-score"]) {
        const chain = (flags["access-chain"] ?? config.chain ?? "base-sepolia") as EvmChain;
        const condition: LitEvmCondition = {
          conditionType: "evmContract",
          contractAddress: config.reputationAddress as EvmAddress,
          standardContractType: "",
          chain,
          method: "getScore",
          parameters: [":userAddress"],
          returnValueTest: { comparator: ">=", value: flags["min-score"] },
        };
        accessConditions.push(condition);
      }
      if (accessConditions.length === 0) {
        error("Lit encryption requires --allow-address <addr> or --min-score <n>");
      }
      putOpts.accessConditions = accessConditions;
    }

    const entry = await client.vault.put(path, value, putOpts);
    const result = {
      path,
      visibility,
      engine,
      encrypted: entry.encrypted,
      timestamp: entry.timestamp,
    };
    if (flags.json !== undefined) {
      output(result, true);
    } else {
      const engineLabel = useLit ? " [lit]" : "";
      process.stdout.write(`Stored "${path}" (${visibility}${engineLabel})\n`);
    }
  } finally {
    await client.destroy();
  }
}

async function vaultGet(args: string[], flags: Record<string, string>): Promise<void> {
  const [path] = args;
  if (!path) error("Usage: orbitmem vault get <path>");

  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  const client = await createClient(config, loadKey());

  try {
    const entry = await client.vault.get(path);
    if (!entry) error(`Not found: ${path}`);
    output(flags.json !== undefined ? entry : entry.value, flags.json !== undefined);
  } finally {
    await client.destroy();
  }
}

async function vaultLs(args: string[], flags: Record<string, string>): Promise<void> {
  const [prefix] = args;

  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  const client = await createClient(config, loadKey());

  try {
    const keys = await client.vault.keys(prefix);
    if (flags.json !== undefined) {
      output(keys, true);
    } else if (keys.length === 0) {
      process.stdout.write("(no entries)\n");
    } else {
      for (const key of keys) {
        process.stdout.write(`${key}\n`);
      }
    }
  } finally {
    await client.destroy();
  }
}

async function vaultPrice(args: string[], flags: Record<string, string>): Promise<void> {
  const action = args[0];
  switch (action) {
    case "set":
      return vaultPriceSet(args.slice(1), flags);
    case "get":
      return vaultPriceGet(args.slice(1), flags);
    case "ls":
      return vaultPriceLs(flags);
    case "rm":
      return vaultPriceRm(args.slice(1), flags);
    default:
      error(`Unknown price command: ${action ?? "(none)"}. Use: set, get, ls, rm`);
  }
}

async function vaultPriceSet(args: string[], flags: Record<string, string>): Promise<void> {
  const [path, amount] = args;
  if (!path || !amount) error("Usage: orbitmem vault price set <path> <amount>");

  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  const client = await createClient(config, loadKey());

  try {
    const currency = flags.currency ?? "USDC";
    await client.pricing.setPrice(path, { amount, currency });
    if (flags.json !== undefined) {
      output({ path, amount, currency }, true);
    } else {
      process.stdout.write(`Set price for "${path}": ${amount} ${currency} per read\n`);
    }
  } finally {
    await client.destroy();
  }
}

async function vaultPriceGet(args: string[], flags: Record<string, string>): Promise<void> {
  const [path] = args;
  if (!path) error("Usage: orbitmem vault price get <path>");

  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  const client = await createClient(config, loadKey());

  try {
    const price = await client.pricing.getPrice(path);
    if (!price) {
      if (flags.json !== undefined) {
        output(null, true);
      } else {
        process.stdout.write(`"${path}" is free (no pricing set)\n`);
      }
    } else if (flags.json !== undefined) {
      output({ path, ...price }, true);
    } else {
      process.stdout.write(`${price.amount} ${price.currency}\n`);
    }
  } finally {
    await client.destroy();
  }
}

async function vaultPriceLs(flags: Record<string, string>): Promise<void> {
  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  const client = await createClient(config, loadKey());

  try {
    const prices = await client.pricing.listPrices();
    if (flags.json !== undefined) {
      output(prices, true);
    } else if (prices.length === 0) {
      process.stdout.write("(no priced paths)\n");
    } else {
      for (const p of prices) {
        process.stdout.write(`${p.path}\t${p.amount} ${p.currency}\n`);
      }
    }
  } finally {
    await client.destroy();
  }
}

async function vaultPriceRm(args: string[], flags: Record<string, string>): Promise<void> {
  const [path] = args;
  if (!path) error("Usage: orbitmem vault price rm <path>");

  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  const client = await createClient(config, loadKey());

  try {
    await client.pricing.removePrice(path);
    if (flags.json !== undefined) {
      output({ path, removed: true }, true);
    } else {
      process.stdout.write(`Removed pricing for "${path}"\n`);
    }
  } finally {
    await client.destroy();
  }
}

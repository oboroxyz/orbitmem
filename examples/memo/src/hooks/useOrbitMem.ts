import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { deriveVaultKeyWithCache } from "@orbitmem/sdk";
import { decryptValue, encryptValue } from "../lib/encryption";
import { initRelay, resetRelay } from "../lib/erc8128";
import * as relay from "../lib/relay";

export interface Memo {
  id: string;
  title: string;
  body: string;
  visibility: "public" | "private";
  created: number;
  updated: number;
}

export function useOrbitMem() {
  const { address, isConnected, status } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vaultKeyRef = useRef<CryptoKey | null>(null);
  const clearVaultKeyRef = useRef<(() => void) | null>(null);

  const loadSingleMemo = useCallback(async (id: string): Promise<Memo | null> => {
    const [titleRes, bodyRes, createdRes, updatedRes] = await Promise.all([
      relay.readEntry(`memos/${id}/title`),
      relay.readEntry(`memos/${id}/body`),
      relay.readEntry(`memos/${id}/created`),
      relay.readEntry(`memos/${id}/updated`),
    ]);

    const isPrivate = titleRes.visibility === "private";
    const key = vaultKeyRef.current;

    const title =
      isPrivate && key
        ? await decryptValue<string>(titleRes.value as string, key)
        : (titleRes.value as string);
    const memoBody =
      isPrivate && key
        ? await decryptValue<string>(bodyRes.value as string, key)
        : (bodyRes.value as string);
    const created =
      isPrivate && key
        ? await decryptValue<number>(createdRes.value as string, key)
        : (createdRes.value as number);
    const updated =
      isPrivate && key
        ? await decryptValue<number>(updatedRes.value as string, key)
        : (updatedRes.value as number);

    return {
      id,
      title,
      body: memoBody,
      visibility: isPrivate ? "private" : "public",
      created,
      updated,
    };
  }, []);

  const loadMemos = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const { keys } = await relay.listKeys("memos/");

      const ids = [...new Set(keys.map((k) => k.split("/")[1]).filter(Boolean))];

      const loaded: Memo[] = [];
      for (const id of ids) {
        try {
          const memo = await loadSingleMemo(id);
          if (memo) loaded.push(memo);
        } catch {
          // Skip memos that fail to load
        }
      }

      loaded.sort((a, b) => b.updated - a.updated);
      setMemos(loaded);
    } catch (e) {
      setError(`Failed to load memos: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [address, loadSingleMemo]);

  // Keep a stable ref to loadMemos so the effect doesn't re-trigger
  const loadMemosRef = useRef(loadMemos);
  loadMemosRef.current = loadMemos;

  const signMessageRef = useRef(signMessageAsync);
  signMessageRef.current = signMessageAsync;

  // Initialize relay session + derive vault key on connect
  useEffect(() => {
    if (status !== "connected" || !address) {
      vaultKeyRef.current = null;
      if (status === "disconnected") {
        resetRelay();
        clearVaultKeyRef.current?.();
        clearVaultKeyRef.current = null;
      }
      setMemos([]);
      return;
    }

    (async () => {
      try {
        // 1. Init relay session transport (ERC-8128 → bearer token, cached)
        initRelay();

        // 2. Derive vault key (signature cached in sessionStorage by SDK)
        const { key, clear } = await deriveVaultKeyWithCache({
          address,
          signMessage: (msg) => signMessageRef.current({ message: msg }),
        });
        vaultKeyRef.current = key;
        clearVaultKeyRef.current = clear;

        // 3. Load memos
        await loadMemosRef.current();
      } catch (e) {
        setError(`Initialization failed: ${e}`);
      }
    })();
  }, [status, address]);

  const saveMemo = useCallback(
    async (memo: {
      id: string;
      title: string;
      body: string;
      visibility: "public" | "private";
      created?: number;
    }) => {
      const now = Date.now();
      const isPrivate = memo.visibility === "private";
      const key = vaultKeyRef.current;

      const writeField = async (field: string, value: unknown) => {
        const stored = isPrivate && key ? await encryptValue(value, key) : value;
        return relay.writeEntry(`memos/${memo.id}/${field}`, stored, memo.visibility);
      };

      await Promise.all([
        writeField("title", memo.title),
        writeField("body", memo.body),
        writeField("created", memo.created ?? now),
        writeField("updated", now),
      ]);

      await loadMemos();
    },
    [loadMemos],
  );

  const deleteMemo = useCallback(
    async (id: string) => {
      if (!confirm("Delete this memo?")) return;
      const fields = ["title", "body", "created", "updated"];
      await Promise.all(fields.map((field) => relay.deleteEntry(`memos/${id}/${field}`)));
      await loadMemos();
    },
    [loadMemos],
  );

  return {
    address,
    isConnected,
    memos,
    loading,
    error,
    saveMemo,
    deleteMemo,
    refresh: loadMemos,
  };
}

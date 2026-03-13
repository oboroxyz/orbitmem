import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { decryptValue, deriveVaultKey, encryptValue } from "../lib/encryption";
import { createErc8128Headers } from "../lib/erc8128";
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
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vaultKeyRef = useRef<CryptoKey | null>(null);

  const getHeaders = useCallback(
    async (method: string, url: string, body?: string) => {
      return createErc8128Headers(method, url, body);
    },
    [],
  );

  const loadSingleMemo = useCallback(
    async (id: string): Promise<Memo | null> => {
      const readField = async (field: string) => {
        const readBody = JSON.stringify({ path: `memos/${id}/${field}` });
        const readHeaders = await getHeaders("POST", "/v1/vault/read", readBody);
        return relay.readEntry(`memos/${id}/${field}`, readHeaders);
      };

      const [titleRes, bodyRes, createdRes, updatedRes] = await Promise.all([
        readField("title"),
        readField("body"),
        readField("created"),
        readField("updated"),
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
    },
    [getHeaders],
  );

  const loadMemos = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const body = JSON.stringify({ prefix: "memos/" });
      const headers = await getHeaders("POST", "/v1/vault/keys", body);
      const { keys } = await relay.listKeys(headers, "memos/");

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
  }, [address, getHeaders, loadSingleMemo]);

  // Keep a stable ref to loadMemos so the effect doesn't re-trigger
  const loadMemosRef = useRef(loadMemos);
  loadMemosRef.current = loadMemos;

  const signMessageRef = useRef(signMessageAsync);
  signMessageRef.current = signMessageAsync;

  // Derive vault key on connect
  useEffect(() => {
    if (!isConnected || !address) {
      vaultKeyRef.current = null;
      setMemos([]);
      return;
    }

    (async () => {
      try {
        const sig = await signMessageRef.current({ message: "OrbitMem Vault Key v1" });
        const sigBytes = new Uint8Array(
          (sig.slice(2).match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)),
        );
        vaultKeyRef.current = await deriveVaultKey(sigBytes);
        await loadMemosRef.current();
      } catch (e) {
        setError(`Key derivation failed: ${e}`);
      }
    })();
  }, [isConnected, address]);

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
        const writeBody = JSON.stringify({
          path: `memos/${memo.id}/${field}`,
          value: stored,
          visibility: memo.visibility,
        });
        const headers = await getHeaders("POST", "/v1/vault/write", writeBody);
        return relay.writeEntry(`memos/${memo.id}/${field}`, stored, memo.visibility, headers);
      };

      await Promise.all([
        writeField("title", memo.title),
        writeField("body", memo.body),
        writeField("created", memo.created ?? now),
        writeField("updated", now),
      ]);

      await loadMemos();
    },
    [getHeaders, loadMemos],
  );

  const deleteMemo = useCallback(
    async (id: string) => {
      if (!confirm("Delete this memo?")) return;
      const fields = ["title", "body", "created", "updated"];
      await Promise.all(
        fields.map(async (field) => {
          const delBody = JSON.stringify({ path: `memos/${id}/${field}` });
          const headers = await getHeaders("POST", "/v1/vault/delete", delBody);
          return relay.deleteEntry(`memos/${id}/${field}`, headers);
        }),
      );
      await loadMemos();
    },
    [getHeaders, loadMemos],
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

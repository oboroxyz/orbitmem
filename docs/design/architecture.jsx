import { useState } from "react";

const L = [
  { id: "identity", name: "Identity", tech: "Porto · EVM · Solana", color: "#00E5FF", icon: "◈",
    desc: "Passkey biometric login (Porto/WebAuthn), MetaMask/WalletConnect, Phantom/Solflare. Session keys for scoped agent delegation.",
    apis: ["connect()", "createSessionKey()", "signChallenge()"] },
  { id: "transport", name: "Transport", tech: "ERC-8128 + Sessions", color: "#7C4DFF", icon: "⇌",
    desc: "ERC-8128 signed HTTP with session tokens. Sign once, get a bearer token — zero wallet prompts on reload. Supports ECDSA, Ed25519, P256/WebAuthn.",
    apis: ["createRelaySession()", "relay.fetch()", "createSignedRequest()"] },
  { id: "data", name: "Data Vault", tech: "OrbitDB Nested", color: "#00E676", icon: "⬡",
    desc: "Nested key-value store (@orbitdb/nested-db). Path-based access with per-path visibility: Public, Private, Shared — each subtree can have its own encryption.",
    apis: ["vault.put('travel/dietary', val, {visibility})", "vault.get('travel')", "vault.insert(obj)", "vault.all()"] },
  { id: "encryption", name: "Encryption", tech: "Lit / AES-256", color: "#FF6D00", icon: "⊛",
    desc: "Lit Protocol for on-chain condition-gated access (reputation-gated). AES-256-GCM for fast local encryption. Choose per record.",
    apis: ["encrypt(data, conditions)", "decrypt(blob)", "createCondition()"] },
  { id: "payments", name: "Payments", tech: "MPP · HTTP 402", color: "#FFD600", icon: "⊕",
    desc: "Pay-per-read vault monetization via Machine Payments Protocol. Producers set per-path prices, agents pay directly via stablecoins, Stripe, or Lightning.",
    apis: ["pricing.setPrice(path, {amount, currency})", "pricing.getPrice(path)", "pricing.listPrices()"] },
  { id: "persistence", name: "Persistence", tech: "Storacha", color: "#FF1744", icon: "◉",
    desc: "Auto-archives encrypted snapshots to Filecoin/IPFS. Storacha never sees plaintext — only encrypted blobs.",
    apis: ["archive(snapshot)", "retrieve(cid)", "pinToFilecoin()"] },
  { id: "trust", name: "Trust & Discovery", tech: "ERC-8004", color: "#448AFF", icon: "◎",
    desc: "Users register data as scored on-chain assets (ERC-721). Agents discover & evaluate quality. Agents rate data after consumption.",
    apis: ["registerData(key, tags)", "findData(query)", "rateData()", "getDataScore()"] },
];

const FLOW = [
  { n: "1", label: "Auth", sub: "Porto / EVM / Solana", color: "#00E5FF" },
  { n: "2", label: "Register & Discover", sub: "Data score + quality", color: "#448AFF" },
  { n: "3", label: "Write Vault", sub: "Public / Private / Shared", color: "#00E676" },
  { n: "4", label: "Encrypt", sub: "Lit (rep-gated) / AES", color: "#FF6D00" },
  { n: "5", label: "Agent Fetch", sub: "ERC-8128 signed request", color: "#7C4DFF" },
  { n: "6", label: "Pay-per-Read", sub: "MPP 402 → credential", color: "#FFD600" },
  { n: "7", label: "Execute → Rate", sub: "Mutual feedback loop", color: "#FF1744" },
];

const mono = "'DM Mono', monospace";
const sans = "'DM Sans', 'Helvetica Neue', sans-serif";

export default function App() {
  const [sel, setSel] = useState("payments");
  const a = L.find(l => l.id === sel);

  return (
    <div style={{ minHeight: "100vh", background: "#08090c", color: "#e0e0e0", fontFamily: sans, display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <header style={{ padding: "28px 32px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", background: "linear-gradient(135deg, #00E5FF, #448AFF, #7C4DFF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>OrbitMem</span>
          <span style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>v0.3.0</span>
        </div>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: mono, letterSpacing: "0.03em" }}>
          Sovereign Data Layer · Bidirectional Trust · Multi-Chain
        </p>
      </header>

      <div style={{ flex: 1, display: "flex" }}>
        <nav style={{ width: 240, borderRight: "1px solid rgba(255,255,255,0.06)", padding: "12px 0", flexShrink: 0 }}>
          {L.map(l => {
            const on = sel === l.id;
            return (
              <button key={l.id} onClick={() => setSel(l.id)} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 18px",
                border: "none", background: on ? `${l.color}0C` : "transparent",
                borderLeft: `2px solid ${on ? l.color : "transparent"}`, cursor: "pointer", textAlign: "left",
              }}>
                <span style={{
                  width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, background: `${l.color}14`, color: l.color, border: `1px solid ${l.color}20`, flexShrink: 0,
                }}>{l.icon}</span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: on ? l.color : "rgba(255,255,255,0.65)" }}>{l.name}</div>
                  <div style={{ fontFamily: mono, fontSize: 9.5, color: "rgba(255,255,255,0.22)", marginTop: 1 }}>{l.tech}</div>
                </div>
              </button>
            );
          })}
        </nav>

        <main style={{ flex: 1, padding: "28px 36px", overflowY: "auto" }}>
          {a && (
            <div key={a.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, background: `${a.color}14`, color: a.color, border: `1px solid ${a.color}28`,
                }}>{a.icon}</div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: a.color }}>{a.name}</h2>
                  <div style={{ fontFamily: mono, fontSize: 10.5, color: "rgba(255,255,255,0.28)", marginTop: 1 }}>{a.tech}</div>
                </div>
              </div>

              <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "rgba(255,255,255,0.5)", margin: "0 0 20px", maxWidth: 520 }}>{a.desc}</p>

              <div style={{ padding: "14px 18px", borderRadius: 9, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>API</div>
                {a.apis.map((api, i) => (
                  <div key={i} style={{ fontFamily: mono, fontSize: 11.5, color: a.color, opacity: 0.75, padding: "3px 0", borderBottom: i < a.apis.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>{api}</div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 36 }}>
            <div style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,0.18)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Data Flow</div>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5 }}>
              {FLOW.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 7, background: `${f.color}08`, border: `1px solid ${f.color}15` }}>
                    <span style={{ fontFamily: mono, fontSize: 9, color: f.color, fontWeight: 700, opacity: 0.5 }}>{f.n}</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: f.color }}>{f.label}</div>
                      <div style={{ fontFamily: mono, fontSize: 8.5, color: "rgba(255,255,255,0.2)", marginTop: 1 }}>{f.sub}</div>
                    </div>
                  </div>
                  {i < FLOW.length - 1 && <span style={{ color: "rgba(255,255,255,0.1)", fontSize: 12 }}>→</span>}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 28, padding: "16px 20px", borderRadius: 9, background: "rgba(68,138,255,0.03)", border: "1px solid rgba(68,138,255,0.1)" }}>
            <div style={{ fontFamily: mono, fontSize: 9, color: "#448AFF", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, opacity: 0.6 }}>Bidirectional Trust Cycle</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.9 }}>
              User registers data → Agent discovers & checks DataScore →<br/>
              Agent consumes (quality ≥ threshold) → Agent rates data →<br/>
              Data score updates on-chain ↻
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
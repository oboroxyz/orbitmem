import { createFileRoute, Link } from "@tanstack/react-router";
import type { IconType } from "react-icons";
import { PiLockKey, PiNetwork, PiRobot, PiSealCheck, PiSignature, PiUser } from "react-icons/pi";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const FEATURES: { title: string; description: string; tag: string; icon: IconType }[] = [
  {
    title: "Encrypted Vaults",
    description:
      "P2P data vaults with granular visibility control. Store agent memory with end-to-end encryption — only authorized parties can decrypt.",
    tag: "Privacy",
    icon: PiLockKey,
  },
  {
    title: "Discovery & Trust",
    description:
      "On-chain data discovery and quality scoring via ERC-8004. Every data entry is rated by humans and agents, building a decentralized reputation layer.",
    tag: "ERC-8004",
    icon: PiSealCheck,
  },
  {
    title: "Signed Transport",
    description:
      "Authenticate with Passkey, ETH Wallet, or Solana Wallet — then communicate over ERC-8128 signed HTTP. Every request is cryptographically verified across chains.",
    tag: "ERC-8128",
    icon: PiSignature,
  },
];

const STEPS_CLI = [
  { step: "01", cmd: "npx orbitmem init", desc: "Generate keys and create config" },
  { step: "02", cmd: "npx orbitmem vault store <path> <value>", desc: "Store data in vault" },
  { step: "03", cmd: "npx orbitmem register", desc: "Register data on-chain (ERC-8004)" },
  { step: "04", cmd: "npx orbitmem discover", desc: "Search data sources by quality/tags" },
];

function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="min-h-[36vh] flex flex-col items-center justify-center text-center">
        <h1 className="font-mono text-xxs sm:text-xs tracking-tight">
          {/* biome-ignore format: preserve ASCII art alignment */}
          <pre>▄████▄ ▄▄▄▄  ▄▄▄▄  ▄▄ ▄▄▄▄▄▄ ██▄  ▄██ ▄▄▄▄▄ ▄▄   ▄▄   <br />██  ██ ██▄█▄ ██▄██ ██   ██   ██ ▀▀ ██ ██▄▄  ██▀▄▀██   <br />▀████▀ ██ ██ ██▄█▀ ██   ██   ██    ██ ██▄▄▄ ██   ██ <span className="animate-pulse-0">██</span><br /></pre>
        </h1>
        <p className="mt-6 text-lg text-stone-700 max-w-md leading-relaxed">
          Decentralized Data Layer for Agentic Web.
        </p>
        <div className="grid gap-4 grid-cols-2 mt-10">
          <Link to="/dashboard" className="btn px-6 py-3">
            Get Started &rarr;
          </Link>
          <Link to="/explore" className="btn-outline px-6 py-3">
            Explore &rarr;
          </Link>
        </div>
      </section>

      {/* Use Cases */}
      <section className="max-w-4xl mx-auto pb-16">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-stone-200 p-6 space-y-4">
            <div className="w-10 h-10 rounded-lg bg-stone-200 flex items-center justify-center">
              <PiUser className="text-xl text-stone-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-stone-900 mb-4">For Users, Developers</h3>
              <p className="text-sm text-stone-500 leading-relaxed">
                Create and use a decentralized database in minutes via SDK + CLI — with built-in
                encryption, access control, and automatic P2P backup.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-stone-200 p-6 space-y-4">
            <div className="w-10 h-10 rounded-lg bg-stone-200 flex items-center justify-center">
              <PiRobot className="text-xl text-stone-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-stone-900 mb-2">For AI Agents</h3>
              <p className="text-sm text-stone-500 leading-relaxed">
                Use{" "}
                <code className="text-xs font-mono bg-white px-1.5 py-0.5 rounded">
                  npx orbitmem
                </code>{" "}
                CLI (Skills) to access decentralized database — with built-in data discovery and
                on-chain data reputation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture & Features */}
      <section className="max-w-4xl mx-auto pb-16">
        <h2 className="text-sm font-semibold text-stone-900 mb-6">Architecture</h2>
        <div className="space-y-2 mb-10">
          <div className="rounded-lg bg-stone-900 text-stone-50 px-6 py-3 flex justify-between items-center">
            <span className="text-sm font-semibold">Interface</span>
            <span className="text-xs text-stone-400">SDK + CLI (Skills)</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-stone-200 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-stone-900">Identity</p>
              <p className="text-xs text-stone-400 mt-1">Passkeys + EVM + Solana</p>
            </div>
            <div className="rounded-lg border border-stone-200 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-stone-900">Encryption</p>
              <p className="text-xs text-stone-400 mt-1">Lit Protocol + AES-256-GCM</p>
            </div>
            <div className="rounded-lg border border-stone-200 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-stone-900">Discovery & Trust</p>
              <p className="text-xs text-stone-400 mt-1">ERC-8004 (ERC-721 + Reputation)</p>
            </div>
          </div>
          <div className="rounded-lg border border-stone-200 px-6 py-3 flex justify-between items-center">
            <span className="text-sm font-semibold text-stone-900">Data Vault</span>
            <span className="text-xs text-stone-400">OrbitDB Nested — local-first P2P storage</span>
          </div>
          <div className="rounded-lg border border-stone-200 px-6 py-3 flex justify-between items-center">
            <span className="text-sm font-semibold text-stone-900">Persistence</span>
            <span className="text-xs text-stone-400">Storacha → Filecoin/IPFS</span>
          </div>
        </div>
        <h2 className="text-sm font-semibold text-stone-900 mb-4">Key Features</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-stone-200 px-5 py-3 flex items-center gap-3">
            <PiNetwork className="text-base text-stone-400 shrink-0" />
            <span className="text-sm font-semibold text-stone-900">Fully Decentralized</span>
            <span className="text-xs text-stone-400 ml-auto">IPFS + OrbitDB, offline-first</span>
          </div>
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-stone-200 px-5 py-3 flex items-center gap-3">
              <f.icon className="text-base text-stone-400 shrink-0" />
              <span className="text-sm font-semibold text-stone-900">{f.title}</span>
              <span className="text-xxs font-mono text-stone-400 border border-stone-200 rounded px-1.5 py-0.5 ml-auto">
                {f.tag}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Getting Started */}
      <section className="max-w-4xl mx-auto pb-24">
        <h2 className="text-sm font-semibold text-stone-900 mb-6">Getting Started</h2>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr]">
          {/* CLI path */}
          <div className="rounded-lg border border-stone-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-stone-900">CLI</h3>
              <span className="text-xxs font-mono text-stone-400 border border-stone-200 rounded px-1.5 py-0.5">
                Recommended
              </span>
            </div>
            <div className="space-y-2">
              {STEPS_CLI.map((s) => (
                <div key={s.step} className="flex gap-3">
                  <span className="text-xxs font-mono text-stone-300 pt-1 shrink-0">{s.step}</span>
                  <div>
                    <code className="text-xs font-mono text-stone-900 bg-stone-100 px-1.5 py-0.5 rounded">
                      {s.cmd}
                    </code>
                    <p className="text-xs text-stone-400 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Divider */}
          <div className="flex items-center justify-center -my-1 sm:my-0">
            <span className="text-xs font-mono text-stone-300">or</span>
          </div>
          {/* Web path */}
          <div className="rounded-lg border border-stone-200 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-stone-900">Web Dashboard</h3>
            <div className="space-y-2">
              <div className="flex gap-3">
                <span className="text-xxs font-mono text-stone-300 pt-1 shrink-0">01</span>
                <div>
                  <p className="text-xs text-stone-900">Connect your wallet</p>
                  <p className="text-xs text-stone-400 mt-0.5">Ethereum identity via browser</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xxs font-mono text-stone-300 pt-1 shrink-0">02</span>
                <div>
                  <p className="text-xs text-stone-900">Browse &amp; rate data entries</p>
                  <p className="text-xs text-stone-400 mt-0.5">Explore the Data Registry</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xxs font-mono text-stone-300 pt-1 shrink-0">03</span>
                <div>
                  <p className="text-xs text-stone-900">View trust metrics</p>
                  <p className="text-xs text-stone-400 mt-0.5">Network scores &amp; snapshots</p>
                </div>
              </div>
            </div>
            <Link to="/dashboard" className="btn px-4 py-2 text-xs w-full justify-center">
              Open Dashboard &rarr;
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

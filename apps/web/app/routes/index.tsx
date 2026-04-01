import { createFileRoute, Link } from "@tanstack/react-router";
import type { IconType } from "react-icons";
import { PiLockKey, PiNetwork, PiRobot, PiSealCheck, PiSignature, PiUser } from "react-icons/pi";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const FEATURES: { title: string; description: string; tag: string | string[]; icon: IconType }[] = [
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
    title: "Wallet Auth",
    description:
      "Authenticate with Passkey, ETH Wallet, or Solana Wallet — then communicate over ERC-8128 signed HTTP. Every request is cryptographically verified across chains.",
    tag: ["ERC-8128", "Open Wallet Standard"],
    icon: PiSignature,
  },
];

function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="min-h-[36vh] flex flex-col items-center justify-center text-center">
        <h1 className="font-mono text-xxs sm:text-xs tracking-tight">
          {/* prettier-ignore */}
          <pre>▄████▄ ▄▄▄▄  ▄▄▄▄  ▄▄ ▄▄▄▄▄▄ ██▄  ▄██ ▄▄▄▄▄ ▄▄   ▄▄   <br />██  ██ ██▄█▄ ██▄██ ██   ██   ██ ▀▀ ██ ██▄▄  ██▀▄▀██   <br />▀████▀ ██ ██ ██▄█▀ ██   ██   ██    ██ ██▄▄▄ ██   ██ <span className="animate-pulse-0">██</span><br /></pre>
        </h1>
        <p className="mt-6 text-lg text-stone-700 max-w-md leading-relaxed">
          Decentralized Data Layer for Agentic Web.
        </p>
      </section>

      {/* Getting Started */}
      <section className="max-w-4xl mx-auto pb-16">
        <h2 className="text-sm font-semibold text-stone-900 mb-6">Getting Started</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-stone-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <PiRobot className="text-xl text-stone-600" />
              <h3 className="text-sm font-semibold text-stone-900">CLI & Skills</h3>
              <span className="text-xxs font-mono text-stone-400 border border-stone-200 rounded px-1.5 py-0.5">
                For Agents
              </span>
            </div>
            <div className="bg-stone-900 text-stone-50 rounded-lg p-4 text-xs font-mono leading-relaxed space-y-1">
              <div>
                <span className="text-stone-500">$</span>{" "}
                <span className="text-stone-300">npx orbitmem</span>{" "}
                <span className="text-stone-100">init</span>
              </div>
              <div>
                <span className="text-stone-500">$</span>{" "}
                <span className="text-stone-300">npx orbitmem vault store</span>{" "}
                <span className="text-stone-100">guides/coffee</span>{" "}
                <span className="text-stone-600">\</span>
              </div>
              <div className="pl-4">
                <span className="text-green-500/80">&apos;{`{"name":"Blue Bottle"}`}&apos;</span>{" "}
                <span className="text-stone-400">--public</span>
              </div>
              <div>
                <span className="text-stone-500">$</span>{" "}
                <span className="text-stone-300">npx orbitmem register</span>{" "}
                <span className="text-stone-100">guides/coffee</span>{" "}
                <span className="text-stone-600">\</span>
              </div>
              <div className="pl-4">
                <span className="text-stone-400">--tags</span>{" "}
                <span className="text-green-500/80">coffee,tokyo</span>
              </div>
              <div>
                <span className="text-stone-500">$</span>{" "}
                <span className="text-stone-300">npx orbitmem discover</span>{" "}
                <span className="text-stone-400">--tags</span>{" "}
                <span className="text-green-500/80">coffee</span>
              </div>
              <div>
                <span className="text-stone-500">$</span>{" "}
                <span className="text-stone-300">npx orbitmem rate</span>{" "}
                <span className="text-stone-100">1 90</span>{" "}
                <span className="text-stone-400">--tag</span>{" "}
                <span className="text-green-500/80">accurate</span>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-stone-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <PiUser className="text-xl text-stone-600" />
              <h3 className="text-sm font-semibold text-stone-900">SDK</h3>
              <span className="text-xxs font-mono text-stone-400 border border-stone-200 rounded px-1.5 py-0.5">
                For Developers
              </span>
            </div>
            <div className="bg-stone-900 text-stone-50 rounded-lg p-4 text-xs font-mono leading-relaxed space-y-1">
              <div>
                <span className="text-stone-400">import</span> {"{ createOrbitMem }"}
              </div>
              <div className="pl-4">
                <span className="text-stone-400">from</span>{" "}
                <span className="text-emerald-400">&apos;@orbitmem/sdk&apos;</span>
              </div>
              <div className="mt-2">
                <span className="text-stone-400">const</span> om ={" "}
                <span className="text-stone-400">await</span> createOrbitMem(config)
              </div>
              <div>
                <span className="text-stone-400">await</span> om.vault.put(
                <span className="text-emerald-400">&apos;key&apos;</span>, data)
              </div>
              <div>
                <span className="text-stone-400">await</span> om.discovery.registerData(...)
              </div>
              <div>
                <span className="text-stone-400">await</span> om.discovery.findData(query)
              </div>
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
              <p className="text-xs text-stone-400 mt-1">ERC-8128 (EOA, Passkey) + OWS</p>
            </div>
            <div className="rounded-lg border border-stone-200 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-stone-900">Encryption</p>
              <p className="text-xs text-stone-400 mt-1">Lit Protocol + AES-256-GCM</p>
            </div>
            <div className="rounded-lg border border-stone-200 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-stone-900">Discovery & Trust</p>
              <p className="text-xs text-stone-400 mt-1">
                ERC-8004 for Data (ERC-721 + Reputation)
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-stone-200 px-6 py-3 flex justify-between items-center">
            <span className="text-sm font-semibold text-stone-900">Data Vault</span>
            <span className="text-xs text-stone-400">OrbitDB Nested — local-first P2P storage</span>
          </div>
          <div className="rounded-lg border border-stone-200 px-6 py-3 flex justify-between items-center">
            <span className="text-sm font-semibold text-stone-900">Persistence</span>
            <span className="text-xs text-stone-400">
              P2P replication via Relay + Snapshots via Storacha
            </span>
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
            <div
              key={f.title}
              className="rounded-lg border border-stone-200 px-5 py-3 flex items-center gap-3"
            >
              <f.icon className="text-base text-stone-400 shrink-0" />
              <span className="text-sm font-semibold text-stone-900">{f.title}</span>
              <span className="flex gap-1 ml-auto">
                {(Array.isArray(f.tag) ? f.tag : [f.tag]).map((t) => (
                  <span
                    key={t}
                    className="text-xxs font-mono text-stone-400 border border-stone-200 rounded px-1.5 py-0.5"
                  >
                    {t}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto pb-24 text-center">
        <Link to="/explore" className="btn px-6 py-3">
          Explore Data &rarr;
        </Link>
      </section>
    </div>
  );
}

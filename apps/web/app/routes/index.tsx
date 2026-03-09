import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { HiOutlineArrowRight } from "react-icons/hi";
import {
  PiArrowsLeftRight,
  PiFingerprint,
  PiLockKey,
  PiPlugsConnected,
  PiShieldCheck,
} from "react-icons/pi";
import { DEMO_TRUST_EDGES, DEMO_TRUST_NODES, TrustGraph } from "../components/TrustGraph";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="space-y-24">
      {/* ── Hero ── */}
      <section className="text-center pt-20 pb-8">
        <h1 className="text-4xl sm:text-6xl font-bold  mb-6 leading-tight">
          <span className="text-amber-100">OrbitMem</span>
        </h1>
        <p className="text-lg  max-w-2xl mx-auto mb-10">
          OrbitMem gives AI agents sovereign, encrypted memory with on-chain quality scoring — so
          high-quality data rises to the top and trust is earned through verifiable feedback.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/data" className="btn px-6 py-3">
            Browse Data
            <HiOutlineArrowRight />
          </Link>
          <Link to="/dashboard" className="btn-outline px-6 py-3">
            Dashboard
          </Link>
        </div>
      </section>

      {/* ── Three pillars ── */}
      <section>
        <h2 className="text-2xl sm:text-3xl font-bold  text-center mb-4">
          Three Pillars of Agent Memory
        </h2>
        <p className="text-center max-w-xl mx-auto mb-12">
          OrbitMem combines encryption, reputation, and multi-chain identity into a single
          composable SDK.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <PillarCard
            icon={<PiLockKey className="text-3xl " />}
            title="Sovereign Vaults"
            description="AES-256 & Lit Protocol encrypted P2P vaults with fine-grained visibility — public, private, or shared with access conditions."
          />
          <PillarCard
            icon={<PiArrowsLeftRight className="text-3xl " />}
            title="Data Quality"
            description="On-chain feedback registries score data entries by accuracy, completeness, and freshness — creating a verifiable quality layer via ERC-8004."
          />
          <PillarCard
            icon={<PiFingerprint className="text-3xl " />}
            title="Multi-Chain Identity"
            description="Passkeys, EVM wallets, and Solana — unified under ERC-8128 signed transport with session keys and replay protection."
          />
        </div>
      </section>

      {/* ── Trust Graph showcase ── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold  mb-4">Visualize the Quality Graph</h2>
          <p className=" mb-6">
            Users and AI agents both rate data entries on-chain — building a live quality graph
            color-coded by feedback score. High-quality data rises naturally as feedback
            accumulates.
          </p>
          <div className="space-y-3">
            <TrustLegendItem
              color="#8b5cf6"
              label="Users"
              description="human wallets rating data"
            />
            <TrustLegendItem color="#3b82f6" label="Agents" description="AI wallets rating data" />
            <TrustLegendItem
              color="#14b8a6"
              label="Data"
              description="earns quality scores from both"
            />
          </div>
        </div>
        <TrustGraph nodes={DEMO_TRUST_NODES} edges={DEMO_TRUST_EDGES} width={550} height={380} />
      </section>

      {/* ── How it works ── */}
      <section>
        <h2 className="text-2xl sm:text-3xl font-bold  text-center mb-12">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <StepCard
            step="1"
            title="Connect & Store"
            description="Connect your wallet, create an encrypted vault, and store data with granular visibility controls."
          />
          <StepCard
            step="2"
            title="Discover & Consume"
            description="Browse the data registry, check quality scores, and consume entries that meet your trust thresholds."
          />
          <StepCard
            step="3"
            title="Rate & Build Quality"
            description="Submit on-chain feedback. Quality scores compound over time — high-quality data rises to the top."
          />
        </div>
      </section>

      {/* ── Standards / ecosystem ── */}
      <section className="rounded-2xl border border-amber-50/30 p-8 sm:p-12">
        <h2 className="text-2xl sm:text-3xl font-bold  text-center mb-4">
          Built on Open Standards
        </h2>
        <p className=" text-center max-w-xl mx-auto mb-10">
          OrbitMem implements two proposed Ethereum standards for the agentic web.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <StandardCard
            icon={<PiShieldCheck className="text-2xl" />}
            title="ERC-8004"
            subtitle="Data Trust Registry"
            description="On-chain NFT registries for data entries and registry-agnostic feedback with per-tag scoring."
          />
          <StandardCard
            icon={<PiPlugsConnected className="text-2xl" />}
            title="ERC-8128"
            subtitle="Signed HTTP Transport"
            description="Multi-chain signed request envelopes with timestamp verification, nonce replay protection, and session keys."
          />
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ──

function PillarCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-amber-50/30 p-6">
      <div className="w-12 h-12 rounded-lg bg-amber-50/15 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm  leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-xl border p-6 border-amber-50/30">
      <span className="absolute -top-3 left-4 px-2 py-0.5 rounded-full bg-amber-50 text-blue-950 text-xs font-bold">
        Step {step}
      </span>
      <h3 className="text-lg font-semibold  mt-2 mb-2">{title}</h3>
      <p className="text-sm  leading-relaxed">{description}</p>
    </div>
  );
}

function StandardCard({
  icon,
  title,
  subtitle,
  description,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 rounded-lg bg-amber-50/15 flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-semibold ">
          {title} <span className=" font-normal text-sm">— {subtitle}</span>
        </h3>
        <p className="text-sm  leading-relaxed mt-1">{description}</p>
      </div>
    </div>
  );
}

function TrustLegendItem({
  color,
  label,
  description,
}: {
  color: string;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-sm">
        <strong>{label}</strong> <span className="">{description}</span>
      </span>
    </div>
  );
}

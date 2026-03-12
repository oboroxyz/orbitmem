import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { Layout } from "../components/Layout";
import appCss from "../index.css?url";
import { wagmiConfig } from "../lib/wagmi";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "OrbitMem — Sovereign Data Layer for AI Agents" },
      {
        name: "description",
        content:
          "Encrypted P2P vaults, verifiable data quality, and multi-chain identity for the agentic web.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "OrbitMem — Sovereign Data Layer for AI Agents" },
      {
        property: "og:description",
        content:
          "Encrypted vaults, verifiable data quality, and multi-chain identity for the agentic web.",
      },
      { property: "og:site_name", content: "OrbitMem" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@oboroxyz" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/logo.png" },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Layout>
          <Outlet />
        </Layout>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

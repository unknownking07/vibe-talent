"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
export const PRIVY_CONFIGURED = !!PRIVY_APP_ID;

// Solana Wallet Standard connectors, so Privy detects installed wallets instead
// of redirecting to download pages. Cached at module scope because Privy expects
// a stable reference across re-renders — same approach as the promote card.
let solanaConnectorsCache: ReturnType<typeof toSolanaWalletConnectors> | null = null;
function getSolanaConnectors() {
  if (solanaConnectorsCache === null) {
    solanaConnectorsCache = toSolanaWalletConnectors();
  }
  return solanaConnectorsCache;
}

/**
 * Privy configured for Solana only — every burn flow is Solana, unlike the
 * promote card which also supports Base.
 *
 * Mount this inside the feature component (never the root layout) so the
 * ~60-chunk web3 stack only loads when a burn UI actually renders.
 */
export function BurnProvider({ children }: { children: React.ReactNode }) {
  if (!PRIVY_CONFIGURED) return null;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID!}
      config={{
        loginMethods: ["wallet"],
        appearance: {
          walletList: ["phantom", "solflare", "backpack", "detected_solana_wallets"],
          walletChainType: "solana-only",
        },
        externalWallets: { solana: { connectors: getSolanaConnectors() } },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

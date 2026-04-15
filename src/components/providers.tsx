"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { base, mainnet, arbitrum } from "viem/chains";

// Wallet Standard connectors for Solana. Without this, Privy has no way to
// detect installed Solana wallets and falls back to sending users to the
// wallet's download page (e.g. clicking "phantom" opens phantom.app instead
// of the installed extension).
const solanaConnectors = toSolanaWalletConnectors();

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // Skip Privy if app ID is not configured (e.g. local dev without env)
  if (!appId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["wallet", "email"],
        defaultChain: base,
        supportedChains: [base, mainnet, arbitrum],
        appearance: {
          walletList: [
            "rabby_wallet",
            "metamask",
            "coinbase_wallet",
            "rainbow",
            "wallet_connect",
            // Catch-all for any other installed EVM wallet (Frame, Trust, OKX,
            // etc.) detected via EIP-6963.
            "detected_ethereum_wallets",
            // Explicit Solana wallets (shown in this order in the modal)
            "phantom",
            "backpack",
            "solflare",
            "jupiter",
            // Catch-all for any other installed Solana wallet (Glow, Coin98,
            // Exodus, etc.) detected via the Wallet Standard.
            "detected_solana_wallets",
          ],
          walletChainType: "ethereum-and-solana",
        },
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

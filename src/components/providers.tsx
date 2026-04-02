"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { base } from "viem/chains";

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
        loginMethods: ["wallet"],
        defaultChain: base,
        supportedChains: [base],
        appearance: {
          walletList: ["metamask", "rainbow", "wallet_connect", "coinbase_wallet"],
          walletChainType: "ethereum-only",
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "off",
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

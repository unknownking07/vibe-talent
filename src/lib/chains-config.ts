// Multi-chain configuration for USDC payments

export type EVMChainConfig = {
  type: "evm";
  name: string;
  chainId: number;
  rpc: string;
  contractAddr: string;
  usdcAddr: string;
  usdcDecimals: number;
  explorerUrl: string;
  nativeCurrency: string;
};

export type SolanaChainConfig = {
  type: "solana";
  name: "Solana";
  rpc: string;
  receivingWallet: string;
  usdcMint: string;
  usdcDecimals: number;
  vibeMint: string;
  vibeDecimals: number;
  explorerUrl: string;
};

export type ChainConfig = EVMChainConfig | SolanaChainConfig;

export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  base: {
    type: "evm",
    name: "Base",
    chainId: 8453,
    rpc: "https://mainnet.base.org",
    contractAddr: "0x2cDB438f418f5cb53e8Ea87cFD981397FDe3d0da",
    usdcAddr: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdcDecimals: 6,
    explorerUrl: "https://basescan.org/tx/",
    nativeCurrency: "ETH",
  },
  solana: {
    type: "solana",
    name: "Solana",
    rpc: "https://api.mainnet-beta.solana.com",
    receivingWallet: "DYp2cUmgoBEYPxN9xPwiqKZoi5WR4SRAWJnLD1d5QAdT",
    usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    usdcDecimals: 6,
    // $VIBE (Bags-launched, "VIBE TALENT"). Priced via GeckoTerminal — not on Jupiter.
    vibeMint: "FfDYT3WqimMw7itMxw4kYJ26GPG78RfpZmepQCFpBAGS",
    vibeDecimals: 9,
    explorerUrl: "https://solscan.io/tx/",
  },
  // Future EVM chains — add contract addresses once deployed:
  // ethereum: {
  //   type: "evm",
  //   name: "Ethereum",
  //   chainId: 1,
  //   rpc: "https://eth.llamarpc.com",
  //   contractAddr: "TBD",
  //   usdcAddr: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  //   usdcDecimals: 6,
  //   explorerUrl: "https://etherscan.io/tx/",
  //   nativeCurrency: "ETH",
  // },
};

// Solana payments are verified server-side before a promotion is granted:
// POST /api/solana/verify checks the on-chain transfer (success, correct mint,
// destination = receivingWallet, amount ≥ slippage floor, signature uniqueness)
// and records the promotion in featured_promotions. Both USDC and $VIBE are
// accepted on Solana. See docs/superpowers/specs/2026-05-30-solana-vibe-payments.
export const SUPPORTED_CHAINS = Object.keys(CHAIN_CONFIGS);
export const DEFAULT_CHAIN = "base";

export function getChainConfig(chainKey: string): ChainConfig {
  return CHAIN_CONFIGS[chainKey] || CHAIN_CONFIGS[DEFAULT_CHAIN];
}

export function isEVMChain(config: ChainConfig): config is EVMChainConfig {
  return config.type === "evm";
}

export function isSolanaChain(config: ChainConfig): config is SolanaChainConfig {
  return config.type === "solana";
}

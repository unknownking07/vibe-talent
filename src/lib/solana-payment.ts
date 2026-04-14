import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";

/**
 * Build a Solana USDC transfer transaction (serialized as Uint8Array).
 * Handles associated token account creation if the receiver doesn't have one yet.
 * Returns the serialized transaction ready for wallet signing.
 */
export async function buildSolanaUSDCTransfer({
  senderAddress,
  rpcUrl,
  usdcMint,
  receivingWallet,
  amount,
}: {
  senderAddress: string;
  rpcUrl: string;
  usdcMint: string;
  receivingWallet: string;
  amount: bigint;
}): Promise<Uint8Array> {
  const connection = new Connection(rpcUrl, "confirmed");
  const mint = new PublicKey(usdcMint);
  const sender = new PublicKey(senderAddress);
  const receiver = new PublicKey(receivingWallet);

  // Get associated token accounts
  const senderAta = await getAssociatedTokenAddress(mint, sender);
  const receiverAta = await getAssociatedTokenAddress(mint, receiver);

  const tx = new Transaction();

  // Check if receiver ATA exists, create if not
  try {
    await getAccount(connection, receiverAta);
  } catch {
    tx.add(
      createAssociatedTokenAccountInstruction(sender, receiverAta, receiver, mint)
    );
  }

  // Add transfer instruction
  tx.add(
    createTransferInstruction(senderAta, receiverAta, sender, amount)
  );

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = sender;

  return tx.serialize({ requireAllSignatures: false });
}

/**
 * Confirm a Solana transaction by signature.
 */
export async function confirmSolanaTransaction(
  rpcUrl: string,
  signature: string
): Promise<void> {
  const connection = new Connection(rpcUrl, "confirmed");
  await connection.confirmTransaction(signature, "confirmed");
}

/**
 * Convert a Uint8Array signature to a base58 string.
 */
export function signatureToString(sig: Uint8Array): string {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = BigInt(0);
  for (const byte of sig) {
    num = num * BigInt(256) + BigInt(byte);
  }
  let str = "";
  while (num > 0) {
    str = ALPHABET[Number(num % BigInt(58))] + str;
    num = num / BigInt(58);
  }
  // Leading zeros
  for (const byte of sig) {
    if (byte === 0) str = "1" + str;
    else break;
  }
  return str;
}

import { Buffer } from "buffer";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TokenAccountNotFoundError,
} from "@solana/spl-token";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

/**
 * Build a Solana SPL-token transfer (USDC or $VIBE), serialized for signing.
 * Creates the receiver's associated token account if needed, and attaches an
 * optional memo. The memo binds the payment to a specific project so the server
 * can verify it belongs to the submitting owner (see /api/solana/verify).
 */
export async function buildSolanaTokenTransfer({
  senderAddress,
  rpcUrl,
  mint: mintAddress,
  receivingWallet,
  amount,
  memo,
}: {
  senderAddress: string;
  rpcUrl: string;
  mint: string;
  receivingWallet: string;
  amount: bigint;
  memo?: string;
}): Promise<Uint8Array> {
  const connection = new Connection(rpcUrl, "confirmed");
  const mint = new PublicKey(mintAddress);
  const sender = new PublicKey(senderAddress);
  const receiver = new PublicKey(receivingWallet);

  const senderAta = await getAssociatedTokenAddress(mint, sender);
  const receiverAta = await getAssociatedTokenAddress(mint, receiver);

  const tx = new Transaction();

  // Create the receiver's associated token account only if it's genuinely
  // missing. Other failures (RPC error, invalid owner/size) must propagate —
  // blindly adding a create instruction would make the tx fail when the ATA
  // already exists.
  try {
    await getAccount(connection, receiverAta);
  } catch (e) {
    if (e instanceof TokenAccountNotFoundError) {
      tx.add(createAssociatedTokenAccountInstruction(sender, receiverAta, receiver, mint));
    } else {
      throw e;
    }
  }

  tx.add(createTransferInstruction(senderAta, receiverAta, sender, amount));

  if (memo) {
    tx.add(
      new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memo, "utf8"),
      })
    );
  }

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

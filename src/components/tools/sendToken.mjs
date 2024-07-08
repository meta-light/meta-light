import { Transaction, Connection, PublicKey } from "@solana/web3.js";
import { createTransferCheckedInstruction, getAssociatedTokenAddress } from "@solana/spl-token";

export async function transfer() {
  const connection = new Connection();
  const feePayer = null;
  const prevOwner = null;
  const mintPubkey = new PublicKey("4umMdShNxbdnoV2EZjUp6h5GYYneZFLH9otBEU2K3ZYP");
  const receiveAdress = new PublicKey('2xSHLfiPs3aEhzbLnYbyzWYMEaYnwSwJwAnVh5CwHWwX');
  const tokenAccount1Pubkey = new PublicKey("CE2uTSeVbBhy2Q8qVEnp8qAJYBQkVxMC4uGzchiAn6gG");

  let ata = await getAssociatedTokenAddress(mintPubkey, receiveAdress);

  const tokenAccount2Pubkey = new PublicKey(ata);
  let tx = new Transaction();
  tx.add(
    createTransferCheckedInstruction(
      tokenAccount1Pubkey, // from
      mintPubkey, // mint
      tokenAccount2Pubkey, // to
      prevOwner, // from's owner
      1, // amount
      0 // decimals
    )
  );

  console.log(`txhash: ${await connection.sendTransaction(tx, [feePayer, prevOwner])}`);
}
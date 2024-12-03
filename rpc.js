const {
  VersionedTransaction,
  Connection,
  Keypair,
} = require("@solana/web3.js");
const bs58 = require("bs58");
const fs = require("fs");

const RPC_ENDPOINT =
  "https://mainnet.helius-rpc.com/?api-key=9a5936a2-dbcb-48c6-b6ef-b6780e0ef90b";
const web3Connection = new Connection(RPC_ENDPOINT, "confirmed");

async function sendLocalCreateTx() {
  const signerKeyPair = Keypair.fromSecretKey(
    bs58.default.decode(
      "wBgqV2sg4URcg5WX4ZpCBuvxAizPiqaDGvvqytUxKTXyPP9zKSr8uhwz3sBdLFD5CAG8inAEc3Bewqg4oVLAiqv"
    )
  );

  console.log("signerKeyPair", signerKeyPair);

  // Generate a random keypair for token
  const mintKeypair = Keypair.generate();

  // Define token metadata
  const formData = new FormData();
  formData.append("file", await fs.openAsBlob("./logo.jpg")), // Image file
    formData.append("name", "ahsdfasfjasdfas"),
    formData.append("symbol", "LSSDFLJLF"),
    formData.append(
      "description",
      "This is an example token created via PumpPortal.fun"
    ),
    formData.append("twitter", ""),
    formData.append("telegram", ""),
    formData.append("website", ""),
    formData.append("showName", "true");

  // Create IPFS metadata storage
  const metadataResponse = await fetch("https://pump.fun/api/ipfs", {
    method: "POST",
    body: formData,
  });
  const metadataResponseJSON = await metadataResponse.json();

  console.log("[KING]", metadataResponseJSON);
  // Get the create transaction
  const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      publicKey: "Hvt6Ryg53fAusukKm2B22zzaG79NqXWbUvaJUHoTCvbr",
      action: "create",
      tokenMetadata: {
        name: metadataResponseJSON.metadata.name,
        symbol: metadataResponseJSON.metadata.symbol,
        uri: metadataResponseJSON.metadataUri,
      },
      mint: mintKeypair.publicKey.toBase58(),
      denominatedInSol: "true",
      amount: 0.011, // dev buy of 1 SOL
      slippage: 10,
      priorityFee: 0.0005,
      pool: "pump",
    }),
  });
  if (response.status === 200) {
    // successfully generated transaction
    const data = await response.arrayBuffer();
    const tx = VersionedTransaction.deserialize(new Uint8Array(data));
    tx.sign([mintKeypair, signerKeyPair]);
    const signature = await web3Connection.sendTransaction(tx);
    console.log("Transaction: https://solscan.io/tx/" + signature);
  } else {
    console.log(response.statusText); // log error
  }
}

sendLocalCreateTx();

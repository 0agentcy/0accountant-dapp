import { SuiClient, SuiTransactionBlockResponse, DevInspectResults, DryRunTransactionBlockResponse } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction, Inputs } from "@mysten/sui/transactions";
import { SuilendClient } from "@suilend/sdk";
import { fetchReserves } from "../utils/fetchReserves";
import logger, { hexSnippet } from "../utils/logger";

// === ⚙️ Types ===
export type RunStrategyOptions = {
  client: SuiClient;
  keypair: Ed25519Keypair;
  coinType: string;
  depositAmount: bigint;
  gasBudgetAmount: bigint;
  isDryRun: boolean;
  safeMode?: boolean;
  env: {
    PACKAGE_ID: string;
    LENDING_MARKET_OBJ: string;
    LENDING_MARKET_TYPE: string;
  };
};

// A custom return type for dry-run scenarios
export type DryRunResult = {
  mode: "dryRun";
  inspect?: DevInspectResults;
  dryRun: DryRunTransactionBlockResponse;
};  

// Overload for dry-run mode
export async function runStrategy(
  opts: RunStrategyOptions & { isDryRun: true }
): Promise<DryRunResult>;
// Overload for live mode
export async function runStrategy(
  opts: RunStrategyOptions & { isDryRun: false }
): Promise<SuiTransactionBlockResponse | void>;
// Implementation signature
export async function runStrategy(
  opts: RunStrategyOptions
): Promise<SuiTransactionBlockResponse | DryRunResult | void> {

  const {
    client,
    keypair,
    coinType,
    depositAmount,
    gasBudgetAmount,
    isDryRun,
    safeMode = false,
    env: { PACKAGE_ID, LENDING_MARKET_OBJ, LENDING_MARKET_TYPE },
  } = opts;

  logger.info(`🎴 Strategy mode: ${isDryRun ? 'Dry Run (simulated)' : 'Live Transaction'}`);

  // === 🔐 Setup wallet and transaction ===
  const owner = keypair.getPublicKey().toSuiAddress();

  const allCoins = await client.getAllCoins({ owner });
  const balancesByType: Record<string, bigint> = {};
  for (const coin of allCoins.data) {
  const amount = BigInt(coin.balance);
  balancesByType[coin.coinType] = (balancesByType[coin.coinType] || 0n) + amount;
  }

  let balanceLog = '💰 Current Wallet Balances:\n';
  for (const [type, balance] of Object.entries(balancesByType)) {
  balanceLog += `    • ${type}: ${balance} (raw)\n`;
  }
  logger.info(balanceLog.trim());

  // === 🏦 Initialize Suilend client ===
  const suilendClient = await SuilendClient.initialize(
      LENDING_MARKET_OBJ,
      LENDING_MARKET_TYPE,
      client,
      PACKAGE_ID
  );
  logger.info("🔄 Initialized Suilend Client");

  // === 💰 Fetch user's coins and validate target coin ===
  const coins = await client.getAllCoins({ owner });
  const depositCoin = coins.data.find((c) => c.coinType === coinType && BigInt(c.balance) >= depositAmount);
  if (!depositCoin) throw new Error(`No coin of type ${coinType} with sufficient balance found.`);

  const gasCoin = coins.data.find((c) =>
    c.coinType === '0x2::sui::SUI' &&
    c.coinObjectId !== depositCoin.coinObjectId &&
    BigInt(c.balance) >= gasBudgetAmount
  );
  if (!gasCoin) throw new Error(`No separate SUI coin available for gas.`);

  logger.debug(`🪙 Deposit Coin:
  • Type:        ${coinType}
  • Amount:      ${depositAmount}
  • Object ID:   ${depositCoin.coinObjectId}
  • Balance:     ${depositCoin.balance}
  `);
    
  logger.debug(`⛽ Gas Coin:
  • Type:        0x2::sui::SUI
  • Amount:      ${gasBudgetAmount}
  • Object ID:   ${gasCoin.coinObjectId}
  • Balance:     ${gasCoin.balance}
  `);

  const coinFull = await client.getObject({
    id: depositCoin.coinObjectId,
    options: { showContent: true, showType: true, showOwner: true },
  });

  const gasCoinFull = await client.getObject({
    id: gasCoin.coinObjectId,
    options: { showContent: true, showType: true },
  });
    
  // === 📊 Fetch Reserves and derive reserveIndex ===
  const reserves = await fetchReserves(suilendClient.client);
  const matchedIndex = reserves.findIndex((r) => r.coinType === coinType);
  if (matchedIndex === -1) throw new Error(`Reserve not found for coin type: ${coinType}`);
  const reserveIndex = BigInt(matchedIndex);

  // === 🤑 Start transaction
  const tx = new Transaction();
  logger.info(`🤑 Strategy initialized for ${coinType} with deposit of ${depositAmount.toString()}`);

  // === 💱 Prepare coin input and split for deposit ===
  const mainCoinRef = tx.object(Inputs.ObjectRef({
      objectId: coinFull.data!.objectId,
      version: coinFull.data!.version,
      digest: coinFull.data!.digest,
  }));

  logger.debug(`🔍 depositAmount type: ${depositAmount} (type: ${typeof depositAmount})`);

  const reserveIndexArg = tx.pure.u64(reserveIndex);

  logger.info(`📊 Reserve: ${JSON.stringify(reserveIndexArg, null, 2)}`);

  const systemStateArg    = tx.object.system();
  const clockArg          = tx.object.clock();
  const lendingMarketArg  = tx.object(LENDING_MARKET_OBJ);
  logger.debug(`💹 Market: ${JSON.stringify(lendingMarketArg, null, 2)}`);
  logger.debug(`⚙️ System: ${JSON.stringify(systemStateArg, null, 2)}`);
  logger.debug(`🕰️ Clock: ${JSON.stringify(clockArg, null, 2)}`);

  // == 🧱 Build transaction ===
  tx.setSender(owner);
  tx.setGasPayment([
    {
      objectId: gasCoinFull.data!.objectId,
      version: gasCoinFull.data!.version,
      digest: gasCoinFull.data!.digest,
    },
  ]);

  tx.setGasBudget(gasBudgetAmount);

  // === 1️⃣ Move Call: Create Obligation ===

  const [obligationCapArg] = tx.moveCall({
      target: `${PACKAGE_ID}::lending_market::create_obligation`,
      typeArguments: [LENDING_MARKET_TYPE],
      arguments: [lendingMarketArg],
  });

  // == Split coins ===
  const encodedDepositAmount = tx.pure.u64(depositAmount);
  const [coinArg] = tx.splitCoins(mainCoinRef, [encodedDepositAmount]);

  logger.info(`🪙 Coin: ${JSON.stringify(coinArg, null, 2)}`);

  // === 2️⃣ Move Call: Deposit Liquidity & Mint cTokens ===
  const [cTokenCoin] = tx.moveCall({
      target: `${PACKAGE_ID}::lending_market::deposit_liquidity_and_mint_ctokens`,
      typeArguments: [LENDING_MARKET_TYPE, coinType],
      arguments: [lendingMarketArg, reserveIndexArg, clockArg, coinArg],
  });
  
  // === 3️⃣ Move Call: Deposit cTokens into Obligation ===
  tx.moveCall({
      target: `${PACKAGE_ID}::lending_market::deposit_ctokens_into_obligation`,
      typeArguments: [LENDING_MARKET_TYPE, coinType],
      arguments: [lendingMarketArg, reserveIndexArg, obligationCapArg, clockArg, cTokenCoin],
  });

  // === 4️⃣ Move Call: Rebalance Staker ===
  tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::rebalance_staker`,
    typeArguments: [LENDING_MARKET_TYPE],
    arguments:    [lendingMarketArg, reserveIndexArg, systemStateArg],
  });

  // 5️⃣ Return the cap to the user
  tx.transferObjects(
    [obligationCapArg],
    owner
  );

  // === 🧪 Dry Run Mode (not sent onchain) ===
  if (isDryRun) {
    logger.info('🧪 Running dry-run simulation...');
    const kindBytes = await tx.build({ client, onlyTransactionKind: true, });
    logger.debug(`🔧 Built tx bytes: ${hexSnippet(kindBytes)}`);

    // 1) Dev-Inspect using built bytes
    let inspectRes: DevInspectResults | undefined;
    try {
      inspectRes = await client.devInspectTransactionBlock({
        sender: owner,
        transactionBlock: kindBytes,
        additionalArgs: { skipChecks: false },
      });
    } catch (e: any) {
      logger.error(`❌ Dev-Inspect threw exception: ${e.stack ?? e}`);
      return { mode: 'dryRun', inspect: inspectRes, dryRun: {} as DryRunTransactionBlockResponse };
    }

    logger.debug(`🔍 Dev-Inspect Status: ${JSON.stringify(
        inspectRes.error ? { error: inspectRes.error } : { status: inspectRes.effects?.status }, null, 2)}`
    );
  
    if (inspectRes.error || inspectRes.effects.status.status !== 'success') {
      logger.warn(`⚠️ Dev-Inspect failed: ${JSON.stringify(
          { error: inspectRes.error, status: inspectRes.effects.status }, null, 2)}`
      );
      return { mode: 'dryRun', inspect: inspectRes, dryRun: {} as DryRunTransactionBlockResponse };
    }
    const ptbJson = await tx.toJSON();
    logger.debug(`🔧 PTB JSON: ${ptbJson}`);

    // 2) Dry-Run execution using same bytes
    const fullBytes = await tx.build({ client });
    let dryRunRes: DryRunTransactionBlockResponse;
    try {
      dryRunRes = await client.dryRunTransactionBlock({ 
        transactionBlock: fullBytes,});      
    } catch (e: any) {
      logger.error(`❌ Dry-Run threw exception: ${e.stack ?? e}`);
      return { mode: 'dryRun', inspect: inspectRes, dryRun: {} as DryRunTransactionBlockResponse };
    }

    // Log Dry-Run status and object changes
    logger.info(`🛠 Dry-Run Status: ${JSON.stringify( dryRunRes.effects.status, null, 2 )}`);
    logger.debug(`🛠 Dry-Run Created Objects: ${JSON.stringify( dryRunRes.effects.created, null, 2 )}`);
    logger.debug(`🛠 Dry-Run Mutated Objects: ${JSON.stringify( dryRunRes.effects.mutated, null, 2 )}`);

    if (dryRunRes.effects.status.status !== 'success') {
      logger.warn(`⚠️ Dry-Run failed: ${JSON.stringify( { status: dryRunRes.effects.status }, null, 2 )}`);
    }

    return { mode: 'dryRun', inspect: inspectRes, dryRun: dryRunRes };
  }

  // === 💥 Live Execution Path ===
  logger.info('🚀 Running LIVE...');
  const fullBytes = await tx.build({ client });

  // 1) Execute on-chain
  let result;
  if (safeMode) {
    const { signature, bytes } = await keypair.signTransaction(fullBytes);
    result = await client.executeTransactionBlock({
      transactionBlock: bytes,
      signature,
      options: { showEffects: true, showEvents: true },
    });
  } else {
    result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: fullBytes,
      options: { showEffects: true, showEvents: true },
    });
  }

  // 2) Optionally wait for finality
  await client.waitForTransaction({
    digest: result.digest,
    options: { showEffects: true },
  });

  return result;
}
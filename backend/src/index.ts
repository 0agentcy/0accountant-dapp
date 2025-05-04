import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { runStrategy } from './lib/runStrategy';
import logger from './utils/logger';

// === ⚙️ Main Entry Function ===
async function main() {
  // === 🧩 Load Env Config ===
  const PRIVATE_KEY = process.env.PRIVATE_KEY!;
  const SUI_PACKAGE_ID = process.env.SUI_PACKAGE_ID!;
  const LENDING_MARKET_OBJ = process.env.LENDING_MARKET_OBJ!;
  const LENDING_MARKET_TYPE = process.env.LENDING_MARKET_TYPE!;
  const COIN_TYPE = process.env.COIN_TYPE?.trim()!;
  const isDryRun = process.env.DRY_RUN === 'true';

  logger.info(`🔐 Loaded environment config (Dry Run = ${isDryRun})`);

  if (!PRIVATE_KEY || !LENDING_MARKET_OBJ || !LENDING_MARKET_TYPE || !SUI_PACKAGE_ID || !COIN_TYPE) {
    throw new Error("Missing required environment variables.");
  }

  // === 🔐 Setup Wallet ===
  const { secretKey } = decodeSuiPrivateKey(PRIVATE_KEY);
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const owner = keypair.getPublicKey().toSuiAddress();
  logger.info(`👛 Wallet loaded — Address: ${owner}`);

  // === 🌐 Connect to Sui RPC ===
  const url = getFullnodeUrl('mainnet');
  logger.info(`🌍 Connecting to Sui RPC at: ${url}`);
  const suiClient = new SuiClient({ url });
  const version = await suiClient.getRpcApiVersion();
  logger.info(`📡 Connected to Sui RPC (Version: ${version})`);

  // === 🚀 Run Lending Strategy ===
  const depositAmount = 1_000_000_000n;
  const gasBudgetAmount = 100_000_000n;

  logger.info(`⚙️ Executing strategy with:
    • Coin Type: ${COIN_TYPE}
    • Deposit Amount: ${depositAmount}
    • Lending Market Type: ${LENDING_MARKET_TYPE}
    • Package ID: ${SUI_PACKAGE_ID}
    • Market Object ID: ${LENDING_MARKET_OBJ}
  `);

  const commonOpts = {
    client: suiClient,
    keypair,
    coinType: COIN_TYPE,
    depositAmount,
    gasBudgetAmount,
    safeMode: !isDryRun,
    env: {
      PACKAGE_ID: SUI_PACKAGE_ID,
      LENDING_MARKET_OBJ,
      LENDING_MARKET_TYPE,
    },
  };
  
  if (isDryRun) {
    // TS sees isDryRun: true → Promise<DryRunResult>
    const result = await runStrategy({ ...commonOpts, isDryRun: true });
    logger.info('🛠 Dry run complete');
    if (result.inspect) {
      logger.info(`   • Dev-inspect status: ${result.inspect.effects?.status.status}`);
    }
    logger.info(`   • Dry-run status: ${result.dryRun.effects?.status.status}`);
  } else {
    // TS sees isDryRun: false → Promise<SuiTransactionBlockResponse | void>
    const result = await runStrategy({ ...commonOpts, isDryRun: false });
    if (result) {
      logger.info(`✅ Transaction submitted. Digest: ${result.digest}`);
      logger.info(`🔍 Explorer: https://suiscan.xyz/mainnet/tx/${result.digest}`);
    } else {
      logger.warn('⚠️ No transaction was sent (early abort).');
    }
  }
}

// === 🧯 Execute Main & Handle Failure ===
main().catch((err) => {
  logger.error(`❗ ${err.message}`);
  if (err.stack) logger.error('🧵 Stack trace:\n' + err.stack);
});
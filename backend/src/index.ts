import * as path from 'path';
import * as dotenv from 'dotenv';
import minimist from 'minimist';

import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';

import { fetchReserves } from './utils/fetchReserves';
import { runStrategy } from './lib/runStrategy';
import type { Action } from './lib/types';

import logger from './utils/logger';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['lend', 'withdraw', 'swap'],
    string: ['duration'],
    alias: { l: 'lend', w: 'withdraw', s: 'swap', d: 'duration' },
  });

  // Load and validate environment
  const PRIVATE_KEY = process.env.PRIVATE_KEY!;
  const SUI_PACKAGE_ID = process.env.SUI_PACKAGE_ID!;
  const LENDING_MARKET_OBJ = process.env.LENDING_MARKET_OBJ!;
  const LENDING_MARKET_TYPE = process.env.LENDING_MARKET_TYPE!;
  const COIN_TYPE = process.env.COIN_TYPE!.trim();
  const isDryRun = process.env.DRY_RUN === 'true';

  if (
    !PRIVATE_KEY ||
    !SUI_PACKAGE_ID ||
    !LENDING_MARKET_OBJ ||
    !LENDING_MARKET_TYPE ||
    !COIN_TYPE
  ) {
    throw new Error('Missing required environment variables.');
  }

  // Setup wallet & client
  const { secretKey } = decodeSuiPrivateKey(PRIVATE_KEY);
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const suiClient = new SuiClient({ url: getFullnodeUrl('mainnet') });

  // Transaction parameters
  const depositAmount = 500_000_000n;
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

  // 1️⃣ Handle lend + duration scheduling
  if (argv.lend && argv.duration) {
    // Lend action
    const lendAction: Action = {
      protocol: 'SuiLend',
      type: 'lend',
      token: COIN_TYPE,
      amount: depositAmount,
    };

    // Run lend, dry or live, to get obligationCapId
    let obligationCapId: string;

    if (isDryRun) {
      const dry = await runStrategy({ ...commonOpts, actions: [lendAction], isDryRun: true });
      if (!dry.dryRun.effects?.created?.length) throw new Error('Dry-run created nothing');
      obligationCapId = dry.dryRun.effects.created[0].reference.objectId;
    } else {
      const live = await runStrategy({ ...commonOpts, actions: [lendAction], isDryRun: false });
      if (!live?.effects?.created?.length) throw new Error('Live run created nothing');
      obligationCapId = live.effects.created[0].reference.objectId;

      // —— WAIT FOR ON-CHAIN FINALITY! ——
      await suiClient.waitForTransaction({
        digest: live.digest,
        options: { showEffects: true },
      });
      logger.info(`✅ Lend settled on-chain: ${live.digest}`);
    }
    logger.info(`🔒 obligationCapId = ${obligationCapId}`);

    // ➡️ 1) fetch the on-chain reserve list (with their priceInfo IDs)
    const reserves = await fetchReserves(suiClient, {
    PACKAGE_ID: SUI_PACKAGE_ID,
      LENDING_MARKET_OBJ,
      LENDING_MARKET_TYPE,
    });

    const refreshActions: Action[] = reserves.map((reserve, i) => ({
      protocol: 'SuiLend',
      type: 'refreshReservePrice',
      token: COIN_TYPE,
      reserveArrayIndex: BigInt(i),
      priceInfo: reserve.priceInfo,      // now this comes from the array you just fetched
    }));

    if (isDryRun) {
      await runStrategy({
        ...commonOpts,
        actions: refreshActions,
        isDryRun: true,    // literal
      });
    } else {
      await runStrategy({
        ...commonOpts,
        actions: refreshActions,
        isDryRun: false,   // literal
      });
    }
    logger.info(`🔄 Refreshed ${refreshActions.length} reserve priceInfos`);

    // Schedule withdraw after duration
    const minutes = parseInt(argv.duration, 10);
    logger.info(`⏳ Waiting ${minutes} minutes before withdraw...`);
    setTimeout(async () => {
      // Build full withdraw action with needed fields
      const withdrawAction: Action = {
        protocol: 'SuiLend',
        type: 'withdraw',
        token: COIN_TYPE,
        amount: depositAmount,
        obligationCapId,
        reserveArrayIndex: BigInt(0),
        priceInfo: reserves[0].priceInfo,
      };

      await runStrategy({ ...commonOpts, actions: [withdrawAction], isDryRun: false });
      logger.info('✅ Withdraw TX submitted');
    }, minutes * 60_000);

    return;
  }

  // 2️⃣ Immediate actions (lend + swap only; withdraw needs extra fields)
  const actions: Action[] = [];
  if (argv.lend) {
    actions.push({
      protocol: 'SuiLend',
      type: 'lend',
      token: COIN_TYPE,
      amount: depositAmount,
    });
  }
  if (argv.swap) {
    actions.push({
      protocol: 'SomeSwapProtocol',
      type: 'swap',
      token: COIN_TYPE,
      amount: depositAmount,
    });
  }
  if (actions.length === 0) {
    throw new Error('No action specified. Use --lend and/or --swap.');
  }

  // Execute immediate strategy
  if (isDryRun) {
    const dry = await runStrategy({
      ...commonOpts,
      actions,
      isDryRun: true,
    });
    logger.info(`🧪 Dry-run status: ${dry.dryRun.effects?.status?.status}`);
  } else {
    const live = await runStrategy({
      ...commonOpts,
      actions,
      isDryRun: false,
    });
    if (!live) throw new Error('Expected a TransactionBlockResponse on live path');
    logger.info(`🚀 Live TX digest: ${live.digest}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

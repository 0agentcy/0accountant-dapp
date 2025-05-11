import { SuiClient, SuiTransactionBlockResponse, DevInspectResults, DryRunTransactionBlockResponse } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import type { Action, EnvConfig } from "./types";
import { depositAction } from "./actions/deposit";
import { withdrawAction } from './actions/withdraw';
import { refreshReservePrice } from "@suilend/sdk/_generated/suilend/lending-market/functions";

import logger, { hexSnippet } from "../utils/logger";

export type RunStrategyOptions = {
  client: SuiClient;
  keypair: Ed25519Keypair;
  coinType: string;
  depositAmount: bigint;
  gasBudgetAmount: bigint;
  isDryRun: boolean;
  safeMode?: boolean;
  env: EnvConfig;
  actions: Action[];
};

export type DryRunResult = {
  mode: "dryRun";
  inspect?: DevInspectResults;
  dryRun: DryRunTransactionBlockResponse;
};

export async function runStrategy(
  opts: RunStrategyOptions & { isDryRun: true }
): Promise<DryRunResult>;
export async function runStrategy(
  opts: RunStrategyOptions & { isDryRun: false }
): Promise<SuiTransactionBlockResponse | void>;
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
    env,
    actions,
  } = opts;

  const owner = keypair.getPublicKey().toSuiAddress();

  // Fetch all coins once
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

  // Find deposit coin
  const depositCoin = allCoins.data.find(
    (c) => c.coinType === coinType && BigInt(c.balance) >= depositAmount
  );
  if (!depositCoin) throw new Error(`No coin of type ${coinType} with sufficient balance found.`);

  // Find separate gas coin
  const gasCoin = allCoins.data.find(
    (c) =>
      c.coinType === '0x2::sui::SUI' &&
      c.coinObjectId !== depositCoin.coinObjectId &&
      BigInt(c.balance) >= gasBudgetAmount
  );
  if (!gasCoin) throw new Error(`No separate SUI coin available for gas.`);

  // Full object fetch for deposit and gas coins
  const coinFull = await client.getObject({
    id: depositCoin.coinObjectId,
    options: { showContent: true, showType: true, showOwner: true },
  });
  const gasCoinFull = await client.getObject({
    id: gasCoin.coinObjectId,
    options: { showContent: true, showType: true },
  });

  // Build transaction block
  const tx = new Transaction();
  tx.setSender(owner);
  tx.setGasPayment([
    {
      objectId: gasCoinFull.data!.objectId,
      version: gasCoinFull.data!.version,
      digest: gasCoinFull.data!.digest,
    },
  ]);
  tx.setGasBudget(gasBudgetAmount);

  // Dispatch actions dynamically
  for (const action of actions) {
    switch (action.type) {
      case 'lend':
        // deposit without refreshing price
        await depositAction(tx, action, { client, owner, coinFull, gasCoinFull, env });
        break;

      case 'withdraw': {
        // 1️⃣ Refresh on-chain PriceInfoObject
        const clockArg = tx.object.clock();
        const reserveIdx = action.reserveArrayIndex;
        if (reserveIdx === undefined) {
          throw new Error('Missing reserveArrayIndex for withdraw action');
        }
        await refreshReservePrice(tx, action.token, {
          lendingMarket: env.LENDING_MARKET_OBJ,
          reserveArrayIndex: reserveIdx,
          clock: clockArg,
          priceInfo: action.priceInfo!,
        });
        // 2️⃣ Perform withdraw
        await withdrawAction(tx, action, { client, owner, coinFull, gasCoinFull, env });
        break;
      }

      case 'refreshReservePrice': {
        const clockArg = tx.object.clock();
        await refreshReservePrice(tx, action.token, {
          lendingMarket: env.LENDING_MARKET_OBJ,
          reserveArrayIndex: action.reserveArrayIndex,
          clock: clockArg,
          priceInfo: action.priceInfo!,
        });
        break;
      }

      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
  }

  // === 🧪 Dry Run Mode (not sent onchain) ===
  if (isDryRun) {
    logger.info('🧪 Running dry-run simulation...');
    const kindBytes = await tx.build({ client, onlyTransactionKind: true });
    logger.debug(`🔧 Built tx bytes: ${hexSnippet(kindBytes)}`);

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

    logger.debug(
      `🔍 Dev-Inspect Status: ${JSON.stringify(
        inspectRes.error ? { error: inspectRes.error } : { status: inspectRes.effects?.status }, null, 2
      )}`
    );

    if (inspectRes.error || inspectRes.effects.status.status !== 'success') {
      logger.warn(
        `⚠️ Dev-Inspect failed: ${JSON.stringify(
          { error: inspectRes.error, status: inspectRes.effects.status }, null, 2
        )}`
      );
      return { mode: 'dryRun', inspect: inspectRes, dryRun: {} as DryRunTransactionBlockResponse };
    }

    const fullBytes = await tx.build({ client });
    let dryRunRes: DryRunTransactionBlockResponse;
    try {
      dryRunRes = await client.dryRunTransactionBlock({ transactionBlock: fullBytes });
    } catch (e: any) {
      logger.error(`❌ Dry-Run threw exception: ${e.stack ?? e}`);
      return { mode: 'dryRun', inspect: inspectRes, dryRun: {} as DryRunTransactionBlockResponse };
    }

    logger.info(`🛠 Dry-Run Status: ${JSON.stringify(dryRunRes.effects.status, null, 2)}`);
    logger.debug(`🛠 Dry-Run Created Objects: ${JSON.stringify(dryRunRes.effects.created, null, 2)}`);
    logger.debug(`🛠 Dry-Run Mutated Objects: ${JSON.stringify(dryRunRes.effects.mutated, null, 2)}`);

    if (dryRunRes.effects.status.status !== 'success') {
      logger.warn(`⚠️ Dry-Run failed: ${JSON.stringify({ status: dryRunRes.effects.status }, null, 2)}`);
    }

    return { mode: 'dryRun', inspect: inspectRes, dryRun: dryRunRes };
  }

  // === 💥 Live Execution Path ===
  logger.info('🚀 Running LIVE...');
  const fullBytes = await tx.build({ client });
  let result;
  if (safeMode) {
    const { signature, bytes } = await keypair.signTransaction(fullBytes);
    result = await client.executeTransactionBlock({ transactionBlock: bytes, signature, options: { showEffects: true, showEvents: true } });
  } else {
    result = await client.signAndExecuteTransaction({ signer: keypair, transaction: fullBytes, options: { showEffects: true, showEvents: true } });
  }
  await client.waitForTransaction({ digest: result.digest, options: { showEffects: true } });
  return result;
}

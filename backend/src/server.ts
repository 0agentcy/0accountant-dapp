// src/server.ts
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';

import logger from './utils/logger';

import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { runStrategy } from './lib/runStrategy';
import type { Action } from './lib/types';

const app = express();
app.use(cors());
app.use(json());

const PORT = process.env.PORT || 3001;
const env = {
  PRIVATE_KEY: process.env.PRIVATE_KEY!,
  SUI_PACKAGE_ID: process.env.SUI_PACKAGE_ID!,
  LENDING_MARKET_OBJ: process.env.LENDING_MARKET_OBJ!,
  LENDING_MARKET_TYPE: process.env.LENDING_MARKET_TYPE!,
  COIN_TYPE: process.env.COIN_TYPE!,
};

const { secretKey } = decodeSuiPrivateKey(env.PRIVATE_KEY);
const keypair = Ed25519Keypair.fromSecretKey(secretKey);

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

app.post('/execute', async (req, res) => {
  const { coinType, amount, dryRun = true } = req.body;

  logger.info(`📩 /execute — coinType: ${coinType}, amount: ${amount}, dryRun: ${dryRun}`);

  try {
    // Build actions array for strategy
    const actions: Action[] = [
      {
        protocol: 'SuiLend',
        type: 'lend',
        token: coinType || env.COIN_TYPE,
        amount: BigInt(amount),
      },
    ];

    const result = await runStrategy({
      client,
      keypair,
      coinType: coinType || env.COIN_TYPE,
      depositAmount: BigInt(amount),
      gasBudgetAmount: 100_000_000n,
      safeMode: !dryRun,
      isDryRun: dryRun,
      actions,
      env: {
        PACKAGE_ID: env.SUI_PACKAGE_ID,
        LENDING_MARKET_OBJ: env.LENDING_MARKET_OBJ,
        LENDING_MARKET_TYPE: env.LENDING_MARKET_TYPE,
      },
    });

    if ('mode' in result && result.mode === 'dryRun') {
      const { effects } = result.dryRun;
      res.status(200).json({
        status: 'ok',
        mode: 'dryRun',
        dryRunStatus: effects?.status?.status ?? 'unknown',
        created: effects?.created?.map(obj => ({ id: obj.reference.objectId })) ?? [],
      });
    } else {
      res.status(200).json({
        status: 'ok',
        mode: 'live',
        digest: (result as any).digest,
        executionStatus: (result as any).effects?.status?.status ?? 'unknown',
      });
    }
  } catch (err: any) {
    logger.error(`❌ Error: ${err.message}`);
    if (err.stack) logger.error(`🧵 Stack:
${err.stack}`);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.listen(PORT, () => {
  logger.info(`🚀 Listening at http://localhost:${PORT}`);
});

// to run: curl.exe -X POST http://localhost:3001/execute -H "Content-Type: application/json" --data "@payload.json"

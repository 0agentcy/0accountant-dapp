import * as path from 'path';
import * as dotenv from 'dotenv';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { fetchReserves } from '../utils/fetchReserves';
import type { EnvConfig } from '../lib/types';

// Load environment variables from .env at project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  // Validate required env vars
  const { SUI_PACKAGE_ID, LENDING_MARKET_OBJ, LENDING_MARKET_TYPE } = process.env;
  if (!SUI_PACKAGE_ID || !LENDING_MARKET_OBJ || !LENDING_MARKET_TYPE) {
    console.error('Missing one of required env vars: SUI_PACKAGE_ID, LENDING_MARKET_OBJ, LENDING_MARKET_TYPE');
    process.exit(1);
  }

  // Instantiate a Sui client against mainnet (or testnet) endpoint
  const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

  // Build EnvConfig to pass into fetchReserves
  const env: EnvConfig = {
    PACKAGE_ID: SUI_PACKAGE_ID,
    LENDING_MARKET_OBJ: LENDING_MARKET_OBJ,
    LENDING_MARKET_TYPE: LENDING_MARKET_TYPE,
    // if your types.ts also expects PYTH_STATE_ID, add that here too
  };

  try {
    const reserves = await fetchReserves(client, env);
    console.log('Fetched reserves:');
    console.log(JSON.stringify(reserves, null, 2));
  } catch (e: any) {
    console.error('Error fetching reserves:', e.message || e);
    process.exit(1);
  }
}

main();
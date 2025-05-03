#!/usr/bin/env tsx
// inspect-package.ts

// 1️⃣ Load your .env (so process.env.SUI_PACKAGE_ID is populated)
import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// 2️⃣ Import the SuiClient and helper
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

// 3️⃣ Grab your PACKAGE_ID
const PACKAGE_ID = process.env.SUI_PACKAGE_ID;
if (!PACKAGE_ID) {
  console.error('❌ Missing SUI_PACKAGE_ID in .env');
  process.exit(1);
}

async function main() {
  try {
    // 4️⃣ Instantiate a client (here on devnet, change if needed)
    const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

    // 5️⃣ Call the JSON-RPC method to list modules by package
    const modules = await client.call(
      'sui_getNormalizedMoveModulesByPackage',
      [PACKAGE_ID]
    );

    // 6️⃣ Print them
    console.log(`On-chain modules in ${PACKAGE_ID}:`, modules);
  } catch (e) {
    console.error('❌ Failed to fetch modules:', e);
    process.exit(1);
  }
}

main();

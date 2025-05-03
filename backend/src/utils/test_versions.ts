// GraphQL + RPC script to fetch versions for Clock, SystemState, and LendingMarket
import * as dotenv from 'dotenv';
dotenv.config();

import { request, gql } from 'graphql-request';
import { SuiClient } from '@mysten/sui/client';

const GRAPHQL_ENDPOINT = 'https://sui-mainnet.mystenlabs.com/graphql';
const RPC_ENDPOINT = 'https://fullnode.mainnet.sui.io:443';

// Load object IDs from environment variables
const OBJECT_IDS = {
  clock: process.env.CLOCK_ID || '0x6',
  system: process.env.SYSTEM_STATE_ID || '0x5',
  lending: process.env.LENDING_MARKET_OBJ || '0x84030d26d85eaa7035084a057f2f11f701b7e2e4eda87551becbc7c97505ece1'
};

const query = gql`
  query MultiObjectVersions {
    clock: object(address: "${OBJECT_IDS.clock}") {
      address
      version
      digest
    }
    system: object(address: "${OBJECT_IDS.system}") {
      address
      version
      digest
    }
    lending: object(address: "${OBJECT_IDS.lending}") {
      address
      version
      digest
    }
  }
`;

type VersionResult = {
  address: string;
  version: string;
  digest: string;
};

type MultiObjectResponse = {
  clock: VersionResult;
  system: VersionResult;
  lending: VersionResult;
};

async function fetchFromGraphQL() {
  try {
    const data: MultiObjectResponse = await request(GRAPHQL_ENDPOINT, query);
    return {
      source: 'GraphQL',
      clock: data.clock?.version || 'N/A',
      system: data.system?.version || 'N/A',
      lending: data.lending?.version || 'N/A'
    };
  } catch (err: any) {
    console.error("❌ GraphQL fetch error:", err.response?.errors || err.message);
    return {
      source: 'GraphQL',
      clock: 'ERROR',
      system: 'ERROR',
      lending: 'ERROR'
    };
  }
}

async function fetchFromRPC() {
  const client = new SuiClient({ url: RPC_ENDPOINT });

  const [clock, system, lending] = await Promise.all([
    client.getObject({ id: OBJECT_IDS.clock }),
    client.getObject({ id: OBJECT_IDS.system }),
    client.getObject({ id: OBJECT_IDS.lending })
  ]);

  return {
    source: 'RPC',
    clock: clock.data?.version.toString() || 'N/A',
    system: system.data?.version.toString() || 'N/A',
    lending: lending.data?.version.toString() || 'N/A'
  };
}

async function compareSources() {
  console.log("\n📊 Comparing shared object versions from GraphQL and RPC:");

  const [graphqlResult, rpcResult] = await Promise.all([
    fetchFromGraphQL(),
    fetchFromRPC()
  ]);

  [graphqlResult, rpcResult].forEach(result => {
    console.log(`\n🔎 Source: ${result.source}`);
    console.log(`  • Clock:    ${result.clock}`);
    console.log(`  • System:   ${result.system}`);
    console.log(`  • Lending:  ${result.lending}`);
  });
}

compareSources();
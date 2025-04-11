import { SuilendClient } from '@suilend/sdk';
import { getFullnodeUrl } from '@mysten/sui/client';

async function main() {
  const client = new SuilendClient({
    rpcUrl: getFullnodeUrl('devnet'),
  });

  const reserves = await client.getReserves();
  console.log('Available reserves:', reserves);
}

main().catch(console.error);



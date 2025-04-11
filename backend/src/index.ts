import 'dotenv/config';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { SuilendClient } from '@suilend/sdk';

async function main() {
  const privateKey = process.env.PRIVATE_KEY!;
  const { secretKey } = decodeSuiPrivateKey(privateKey);
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);

  const suiClient = new SuiClient({ url: getFullnodeUrl('devnet') });
  const suilendClient = new SuilendClient({ rpcUrl: getFullnodeUrl('devnet') });

  console.log('✅ Keypair loaded:', keypair.getPublicKey().toSuiAddress());
  console.log('✅ SuilendClient keys:', Object.keys(suilendClient));

  const owner = keypair.getPublicKey().toSuiAddress();
  const coins = await suiClient.getCoins({ owner });

  console.log(`\n💰 Coins in wallet:`);
  coins.data.forEach((coin, index) => {
    console.log(`${index + 1}. Coin Type: ${coin.coinType}`);
    console.log(`   Amount: ${Number(coin.balance) / 1e9} (raw: ${coin.balance})`);
  });
}

main().catch(console.error);






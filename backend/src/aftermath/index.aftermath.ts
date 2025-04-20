import * as dotenv from 'dotenv';
import { Aftermath, Coin, Helpers } from 'aftermath-ts-sdk';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

dotenv.config({ path: '../.env' }); // 👈 relative to /src/aftermath


async function main() {
    const rawKey = process.env.PRIVATE_KEY!;
    const { secretKey } = decodeSuiPrivateKey(rawKey);
    const keypair = Ed25519Keypair.fromSecretKey(secretKey);
    const walletAddress = keypair.getPublicKey().toSuiAddress();
  
    console.log('👛 Wallet:', walletAddress);
  
    const afSdk = new Aftermath('TESTNET');
    await afSdk.init();
  
    // 🔐 Required Auth Initialization
    const stopAuth = await afSdk.Auth().init({
      signMessageCallback: async ({ message }) => {
        const { signature } = await keypair.signPersonalMessage(message);
        return { signature };
      },
      walletAddress,
    });
  
    // ✅ Authorized call
    const supportedCoins = await afSdk.supportedCoins.getSupportedCoins();
    console.log('📦 Supported coins:', supportedCoins.map(c => c.symbol).join(', '));
  
    // ✅ Cleanup (optional for long-running apps)
    await stopAuth();
  }
  
  main().catch(console.error);

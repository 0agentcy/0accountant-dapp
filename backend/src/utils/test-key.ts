// src/utils/test-key.ts

import * as dotenv from 'dotenv';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

dotenv.config({ path: '../.env' });  // 👈 Force load the correct file

const privateKey = process.env.PRIVATE_KEY!;
console.log('Raw env:', privateKey);

const { secretKey } = decodeSuiPrivateKey(privateKey);
console.log('✅ Private key decoded successfully');


import { bcs } from '@mysten/sui/bcs';
import { Transaction } from '@mysten/sui/transactions';

// Try serializing 0 as a u64 using the preconfigured instance.
const value = 0; // try with a number
const serialized = bcs.U64.serialize(value).toBytes();
console.log("Serialized value (number 0):", serialized, "Length:", serialized.length);

// Also try with a BigInt
const valueBigInt = 0n;
const serializedBI = bcs.U64.serialize(valueBigInt).toBytes();
console.log("Serialized value (0n):", serializedBI, "Length:", serializedBI.length);

// test pure
const tx = new Transaction();
const zeroU64Bytes = new Uint8Array(8); // 8 bytes of 0
console.log("Test zeroU64Bytes (hex):", Buffer.from(zeroU64Bytes).toString("hex"));
const pureArg = tx.pure(zeroU64Bytes);
console.log("Test pureArg:", JSON.stringify(pureArg));

// frontend/src/api/strategy.ts
import axios from 'axios';

export type ExecuteResponse =
  | { status: 'ok'; mode: 'dryRun'; dryRunStatus: string; created: { id: string }[]; }
  | { status: 'ok'; mode: 'live'; digest: string; executionStatus: string; }
  | { status: 'error'; message: string; };

// 1️⃣ Read the API URL from env (set this in frontend/.env as VITE_API_URL)
const API_URL = import.meta.env.VITE_API_URL || '';

// 2️⃣ Create an axios instance
const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Calls our backend /execute endpoint.
 *
 * @param coinType  e.g. "0x2::sui::SUI"
 * @param amount    deposit amount in SUI (as a BigInt)
 * @param dryRun    whether to simulate only
 */
export async function executeStrategy(
  coinType: string,
  amount: bigint,
  dryRun = true
): Promise<ExecuteResponse> {
  const { data } = await api.post<ExecuteResponse>(
    '/execute',
    {
      coinType,
      amount: amount.toString(),
      dryRun,
    },
  );
  return data;
}

// smallest-unit decimals for each token we care about:
export const TOKEN_DECIMALS: Record<string, number> = {
    '0x2::sui::SUI': 9,        // SUI has 9 decimal places
    '0x2::sui::USDC': 6,       // USDC has 6
    'SUI-USDC LP Token': 6,    // whatever your LP-token decimals are
    // …add more as you support them
  };

// src/api/tokenMap.ts
export const TOKEN_ALIASES: Record<string, string> = {
  // common “natural” symbols → full coin type
  SUI:     '0x2::sui::SUI',
  USDC:    '0x2::sui::usd_coin::USDC',
  // …add more as you onboard new tokens
};  
  
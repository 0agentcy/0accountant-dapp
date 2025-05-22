import { SuiClient, SuiObjectResponse } from "@mysten/sui/client";

export type Action =
  | { protocol: string; type: 'lend';    token: string; amount: bigint; obligationCapId?: string; durationMinutes?: number; }
  | { protocol: string; type: 'withdraw'; token: string; amount: bigint; obligationCapId: string; durationMinutes?: number;
      reserveArrayIndex: bigint;    // which slot in LendingMarket::reserves
      priceInfo: string;            // the PriceInfoObject ID you got from fetchReserves
    }
  | { protocol: string; type: 'swap';    token: string; amount: bigint; obligationCapId?: string; durationMinutes?: number; }
  | { protocol: string; type: 'borrow';  token: string; amount: bigint; obligationCapId?: string; durationMinutes?: number; }
  | {
      protocol: 'SuiLend';
      type: 'refreshReservePrice';
      token: string;
      reserveArrayIndex: bigint;
      priceInfo?: string;
    };
  
export type EnvConfig = {
  PACKAGE_ID: string;
  LENDING_MARKET_OBJ: string;
  LENDING_MARKET_TYPE: string;
};  

export interface DepositContext {
  client: SuiClient;
  owner: string;
  coinFull: SuiObjectResponse;
  gasCoinFull: SuiObjectResponse;
  env: EnvConfig;
}

export interface ReserveInfo {
  coinType: string;
  price: string;
  smoothedPrice: string;
  lastUpdateTimestamp: string;
  configCellId: string;
  priceInfo: string;
}
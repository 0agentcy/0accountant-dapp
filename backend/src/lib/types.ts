import { SuiClient, SuiObjectResponse } from "@mysten/sui/client";

export type Action = {
    protocol: string;
    type: 'lend' | 'withdraw' | 'swap' | 'borrow';  // extend as you add more
    token: string;
    amount: bigint;
    // you can add durationMinutes, slippage, etc. here later
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

  
import { Transaction, Inputs } from '@mysten/sui/transactions';
import { SuilendClient } from '@suilend/sdk';
import { fetchReserves } from '../../utils/fetchReserves';
import type { Action, DepositContext } from '../types';

/**
 * Executes a full withdraw flow:
 * 1) refresh_reserve_price
 * 2) withdraw_ctokens
 * 3) option::none
 * 4) redeem_ctokens_and_withdraw_liquidity_request
 * 5) unstake_sui_from_staker
 * 6) fulfill_liquidity_request
 * 7) transfer returned Coin to owner
 */
export async function withdrawAction(
  tx: Transaction,
  action: Action,
  ctx: DepositContext
) {
  const { client, owner, env, coinFull } = ctx;
  const { PACKAGE_ID, LENDING_MARKET_OBJ, LENDING_MARKET_TYPE } = env;

  // Initialize SuiLend client & find reserve index
  const suilendClient = await SuilendClient.initialize(
    LENDING_MARKET_OBJ,
    LENDING_MARKET_TYPE,
    client,
    PACKAGE_ID
  );
  const reserves = await fetchReserves(suilendClient.client);
  const idx = reserves.findIndex(r => r.coinType === action.token);
  if (idx === -1) throw new Error(`Reserve not found for ${action.token}`);
  const reserveIndexArg = tx.pure.u64(BigInt(idx));

  // Common args
  const lendingMarketArg = tx.object(LENDING_MARKET_OBJ);
  const systemStateArg   = tx.object.system();
  const clockArg         = tx.object.clock();

  // ObligationCap object (transferred back to owner after deposit)
  const obligationCapArg = tx.object(
    Inputs.ObjectRef({
      objectId: coinFull.data!.objectId,
      version:  coinFull.data!.version,
      digest:   coinFull.data!.digest,
    })
  );

  // 1️⃣ refresh_reserve_price
  tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::refresh_reserve_price`,
    typeArguments: [LENDING_MARKET_TYPE],
    arguments: [lendingMarketArg, reserveIndexArg, systemStateArg, clockArg],
  });

  // 2️⃣ withdraw_ctokens (burn cTokens to request withdrawal)
  tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::withdraw_ctokens`,
    typeArguments: [LENDING_MARKET_TYPE, action.token],
    arguments: [lendingMarketArg, reserveIndexArg, obligationCapArg, systemStateArg, clockArg,],
  });

  // 3️⃣ option::none<CoinType>() for optional callback arg
  const [noneArg] = tx.moveCall({
    target: `0x1::option::none`,
    typeArguments: [action.token],
    arguments: [],
  });

  // 4️⃣ redeem_ctokens_and_withdraw_liquidity_request
  const [liquidityReqArg] = tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::redeem_ctokens_and_withdraw_liquidity_request`,
    typeArguments: [LENDING_MARKET_TYPE, action.token],
    arguments: [
      lendingMarketArg,
      reserveIndexArg,
      obligationCapArg,
      clockArg,
      noneArg,
    ],
  });

  // 5️⃣ unstake_sui_from_staker (for SUI-specific unstaking)
  tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::unstake_sui_from_staker`,
    typeArguments: [LENDING_MARKET_TYPE],
    arguments: [lendingMarketArg, reserveIndexArg, obligationCapArg],
  });

  // 6️⃣ fulfill_liquidity_request (get the actual Coin<CoinType>)
  const [returnedCoin] = tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::fulfill_liquidity_request`,
    typeArguments: [LENDING_MARKET_TYPE, action.token],
    arguments: [lendingMarketArg, reserveIndexArg, liquidityReqArg],
  });

  // 7️⃣ Transfer the returned coin back to owner
  tx.transferObjects([returnedCoin], owner);
}
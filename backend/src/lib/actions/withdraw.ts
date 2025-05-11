import { Transaction } from '@mysten/sui/transactions';
import type { Action, DepositContext } from '../types';

/**
 * Perform a withdraw action:
 * 1) Refresh on-chain PriceInfoObject for the specified reserve index
 * 2) Burn cTokens to request withdrawal
 * 3) Redeem and fulfill liquidity
 * 4) Transfer returned coins to the owner
 */
export async function withdrawAction(
  tx: Transaction,
  action: Extract<Action, { type: 'withdraw' }>,
  ctx: DepositContext
) {
  const { owner, env } = ctx;
  const { PACKAGE_ID, LENDING_MARKET_OBJ, LENDING_MARKET_TYPE } = env;

  // Prepare common arguments
  const lendingMarketArg = tx.object(LENDING_MARKET_OBJ);
  const reserveIndexArg = tx.pure.u64(action.reserveArrayIndex);
  const systemStateArg = tx.object.system();
  const clockArg = tx.object.clock();
  const priceInfoArg = tx.object(action.priceInfo!);

  // Ensure obligationCapId is provided
  if (!action.obligationCapId) {
    throw new Error('withdrawAction requires obligationCapId');
  }
  const obligationCapArg = tx.object(action.obligationCapId);

  // 1️⃣ Refresh reserve price on-chain
  tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::refresh_reserve_price`,
    typeArguments: [LENDING_MARKET_TYPE],
    arguments: [lendingMarketArg, reserveIndexArg, clockArg, priceInfoArg],
  });

  // 2️⃣ Withdraw cTokens (burn cTokens to request withdrawal)
  const amountArg = tx.pure.u64(action.amount);
  tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::withdraw_ctokens`,
    typeArguments: [LENDING_MARKET_TYPE, action.token],
    arguments: [lendingMarketArg, reserveIndexArg, obligationCapArg, clockArg, amountArg],
  });

  // 3️⃣ Option none<CoinType>()
  const [noneArg] = tx.moveCall({
    target: `0x1::option::none`,
    typeArguments: [action.token],
    arguments: [],
  });

  // 4️⃣ Redeem cTokens and withdraw liquidity request
  const [liquidityReqArg] = tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::redeem_ctokens_and_withdraw_liquidity_request`,
    typeArguments: [LENDING_MARKET_TYPE, action.token],
    arguments: [lendingMarketArg, reserveIndexArg, obligationCapArg, clockArg, noneArg],
  });

  // 5️⃣ Unstake SUI from staker (SUI-specific)
  tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::unstake_sui_from_staker`,
    typeArguments: [LENDING_MARKET_TYPE],
    arguments: [lendingMarketArg, reserveIndexArg, liquidityReqArg, systemStateArg],
  });

  // 6️⃣ Fulfill liquidity request (get actual coins)
  const [returnedCoin] = tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::fulfill_liquidity_request`,
    typeArguments: [LENDING_MARKET_TYPE, action.token],
    arguments: [lendingMarketArg, reserveIndexArg, liquidityReqArg],
  });

  // 7️⃣ Transfer returned coin back to owner
  tx.transferObjects([returnedCoin], owner);
}
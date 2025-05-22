import { Transaction, Inputs } from '@mysten/sui/transactions';
import type { Action, DepositContext } from '../types';
import { refreshReservePrice } from '@suilend/sdk/_generated/suilend/lending-market/functions';

export async function withdrawAction(
  tx: Transaction,
  action: Extract<Action, { type: 'withdraw' }> & { reserveArrayIndex: bigint; obligationCapId: string },
  ctx: DepositContext
) {
  const { client, owner, env } = ctx;
  const { PACKAGE_ID, LENDING_MARKET_OBJ, LENDING_MARKET_TYPE } = env;

  // Prepare common MoveCall arguments
  const lendingMarketArg = tx.object(LENDING_MARKET_OBJ);
  const reserveIndexArg  = tx.pure.u64(action.reserveArrayIndex);
  const clockArg         = tx.object.clock();
  const systemStateArg   = tx.object.system();

  // Fetch and prepare the obligation cap object reference
  const capRef = await client.getObject({ id: action.obligationCapId, options: { showContent: true } });
  if (!capRef.data) throw new Error(`Obligation cap not found: ${action.obligationCapId}`);
  const obligationCapArg = tx.object(
    Inputs.ObjectRef({
      objectId: capRef.data.objectId,
      version:  capRef.data.version,
      digest:   capRef.data.digest,
    })
  );
    // Prepare the on-chain PriceInfoObject reference
  const priceInfoArg = tx.object(action.priceInfo);

  // 1️⃣ Refresh or create the on-chain PriceInfoObject
  // We call refreshReservePrice directly without trying to destructure a returned value
  await refreshReservePrice(tx, action.token, {
    lendingMarket:     lendingMarketArg,
    reserveArrayIndex: action.reserveArrayIndex,
    clock:             clockArg,
    priceInfo:         priceInfoArg,
  });

  // 2️⃣ Burn cTokens to request withdrawal
  const amountArg = tx.pure.u64(action.amount);
  tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::withdraw_ctokens`,
    typeArguments: [LENDING_MARKET_TYPE, action.token],
    arguments: [lendingMarketArg, reserveIndexArg, obligationCapArg, clockArg, amountArg],
  });

  // 3️⃣ Option::none<CoinType>() for callback placeholder
  const [noneArg] = tx.moveCall({
    target: `0x1::option::none`,
    typeArguments: [action.token],
    arguments: [],
  });

  // 4️⃣ Redeem cTokens and request liquidity withdrawal
  const [liquidityReqArg] = tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::redeem_ctokens_and_withdraw_liquidity_request`,
    typeArguments: [LENDING_MARKET_TYPE, action.token],
    arguments: [lendingMarketArg, reserveIndexArg, obligationCapArg, clockArg, noneArg],
  });

  // 5️⃣ Unstake SUI for SUI-specific reserves
  tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::unstake_sui_from_staker`,
    typeArguments: [LENDING_MARKET_TYPE],
    arguments: [lendingMarketArg, reserveIndexArg, liquidityReqArg, systemStateArg],
  });

  // 6️⃣ Fulfill the liquidity request to receive the withdrawn coins
  const [returnedCoin] = tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::fulfill_liquidity_request`,
    typeArguments: [LENDING_MARKET_TYPE, action.token],
    arguments: [lendingMarketArg, reserveIndexArg, liquidityReqArg],
  });

  // 7️⃣ Transfer the resulting coin(s) back to the owner's address
  tx.transferObjects([returnedCoin], owner);
}

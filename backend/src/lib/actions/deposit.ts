import { Transaction, Inputs } from '@mysten/sui/transactions';
import { SuilendClient } from '@suilend/sdk';
import { fetchReserves } from '../../utils/fetchReserves';
import type { Action, DepositContext } from '../types';

export async function depositAction(
  tx: Transaction,
  action: Action,
  ctx: DepositContext
) {
  const { client, owner, env, coinFull } = ctx;
  const { PACKAGE_ID, LENDING_MARKET_OBJ, LENDING_MARKET_TYPE } = env;

  // 1️⃣ Initialize SuiLend client & find reserve index
  const suilendClient = await SuilendClient.initialize(
    LENDING_MARKET_OBJ,
    LENDING_MARKET_TYPE,
    client,
    PACKAGE_ID
  );
  const reserves = await fetchReserves(suilendClient.client);
  const matched = reserves.findIndex((r) => r.coinType === action.token);
  if (matched === -1) throw new Error(`Reserve not found for ${action.token}`);
  const reserveIndexArg = tx.pure.u64(BigInt(matched));

  // 2️⃣ Split off depositAmount from the sender’s coin objects
  //    (assumes prior code did getAllCoins and picked a depositCoin)
  const mainCoinRef = tx.object(
    Inputs.ObjectRef({
      objectId: coinFull.data!.objectId,
      version: coinFull.data!.version,
      digest: coinFull.data!.digest,
    })
  );
  const encodedAmt = tx.pure.u64(action.amount);
  const [coinArg] = tx.splitCoins(mainCoinRef, [encodedAmt]);

  // 3️⃣ Move calls to deposit and mint cTokens
  const [obligationCapArg] = tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::create_obligation`,
    typeArguments: [LENDING_MARKET_TYPE],
    arguments: [tx.object(LENDING_MARKET_OBJ)],
  });

  const [cTokenCoin] = tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::deposit_liquidity_and_mint_ctokens`,
    typeArguments: [LENDING_MARKET_TYPE, action.token],
    arguments: [tx.object(LENDING_MARKET_OBJ), reserveIndexArg, tx.object.clock(), coinArg],
  });

  tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::deposit_ctokens_into_obligation`,
    typeArguments: [LENDING_MARKET_TYPE, action.token],
    arguments: [tx.object(LENDING_MARKET_OBJ), reserveIndexArg, obligationCapArg, tx.object.clock(), cTokenCoin],
  });

  // 4️⃣ Rebalance & return obligation cap so user can later withdraw
  tx.moveCall({
    target: `${PACKAGE_ID}::lending_market::rebalance_staker`,
    typeArguments: [LENDING_MARKET_TYPE],
    arguments: [tx.object(LENDING_MARKET_OBJ), reserveIndexArg, tx.object.system()],
  });
  tx.transferObjects([obligationCapArg], owner);

  // NOTE: the code that picks out which coin object to use as depositCoin
  // and which as gasCoin, plus the tx.setSender, setGasPayment, setGasBudget
  // must still live in your main runner before looping actions.
}

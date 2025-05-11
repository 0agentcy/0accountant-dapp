import { SuiClient } from '@mysten/sui/client';
import type { EnvConfig, ReserveInfo } from '../lib/types';
import logger from '../utils/logger';

/**
 * Fetch and parse the static `reserves` vector under the LendingMarket object.
 * Returns each reserve's coinType, static on-chain price, smoothedPrice,
 * last update timestamp, and its config-cell ID for later on-chain refresh.
 */
export async function fetchReserves(
  client: SuiClient,
  env: EnvConfig
): Promise<Array<ReserveInfo & { configCellId: string }>> {
  const { LENDING_MARKET_OBJ } = env;
  logger.info(`🔍 Loading LendingMarket object: ${LENDING_MARKET_OBJ}`);

  // 1️⃣ Fetch the top‐level LendingMarket
  const marketObj = await client.getObject({
    id: LENDING_MARKET_OBJ,
    options: { showContent: true },
  });
  const fields = (marketObj.data as any).content.fields;

  // 2️⃣ Extract static reserves vector
  const rawReserves = fields.reserves as any[];
  if (!Array.isArray(rawReserves)) {
    throw new Error('No static `reserves` vector found on LendingMarket');
  }
  logger.info(`⚙️ Found ${rawReserves.length} reserves`);

  // 3️⃣ Map into our ReserveInfo + configCellId
  const results = rawReserves.map((entry, i) => {
    const f = entry.fields as Record<string, any>;

    // coinType normalization
    const rawCoin = f.coin_type;
    const coinName = typeof rawCoin === 'string' ? rawCoin : rawCoin.fields.name;
    const [hex, mod, str] = coinName.split('::');
    const shortHex = '0x' + BigInt('0x' + hex).toString(16);
    const coinType = `${shortHex}::${mod}::${str}`;

    // static price data
    const price = typeof f.price === 'string' ? f.price : f.price.fields.value;
    const smoothedPrice =
      typeof f.smoothed_price === 'string'
        ? f.smoothed_price
        : f.smoothed_price.fields.value;
    const lastUpdateTimestamp = f.price_last_update_timestamp_s as string;

    // config cell object ID comes from the nested ReserveConfig.additional_fields bag
    const configStruct = f.config?.fields?.element;
    if (!configStruct) {
      throw new Error(`Reserve at index ${i} missing config struct`);
    }
    const bag = configStruct.fields?.additional_fields;
    if (!bag || !bag.fields?.id?.id) {
      throw new Error(`Reserve at index ${i} missing config cell ID`);
    }
    const configCellId = bag.fields.id.id;

    logger.debug(
      `Reserve[${i}] ${coinType}: price=${price}, smoothed=${smoothedPrice}, configCell=${configCellId}`
    );

    return { coinType, price, smoothedPrice, lastUpdateTimestamp, configCellId, priceInfo:   configCellId };
  });

  logger.info(`✅ Parsed ${results.length} static reserves`);
  return results;
}

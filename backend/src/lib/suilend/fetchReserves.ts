import { SuiClient } from '@mysten/sui/client';
import logger from '../../utils/logger';

const SUPPORTED_RESERVE_COINS = [
  '0x2::sui::SUI',
  '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC'
];

export async function fetchReserves(client: SuiClient) {
  const coinsWithMetadata = [];

  for (const coinType of SUPPORTED_RESERVE_COINS) {
    try {
      const metadata = await client.getCoinMetadata({ coinType });
      coinsWithMetadata.push({
        coinType,
        symbol: metadata.symbol,
        decimals: metadata.decimals,
        name: metadata.name,
      });
    } catch (err) {
      logger.warn(`⚠️ Skipping ${coinType} (metadata not found)`);
    }
  }

  return coinsWithMetadata;
}

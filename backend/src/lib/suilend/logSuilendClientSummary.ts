import { SuilendClient } from "@suilend/sdk";
import logger from "../../utils/logger";

export function logSuilendClientSummary(client: SuilendClient) {
  const market = client.lendingMarket;

  // Debug logs for winston
  logger.debug("🔍 Suilend Client Summary:");
  logger.debug("✅ Initialized successfully");

  const marketId = market.id || "No Market ID";
  const poolType = market.$typeArgs && market.$typeArgs[0] ? market.$typeArgs[0] : "No Pool Type";
  const totalReserves = market.reserves ? market.reserves.length : "No Reserves";
  const totalObligations = market.obligations ? market.obligations.size : "No Obligations";
  const feeReceiver = market.feeReceiver || "No Fee Receiver";
  const badDebtUsd = market.badDebtUsd ? market.badDebtUsd.value.toString() : "No Bad Debt";
  const badDebtLimitUsd = market.badDebtLimitUsd ? market.badDebtLimitUsd.value.toString() : "No Debt Limit";

  // Use winston logger.debug to log each line
  logger.debug(`  📄 Market ID:           ${marketId}`);
  logger.debug(`  📘 Pool Type:           ${poolType}`);
  logger.debug(`  📊 Total Reserves:      ${totalReserves}`);
  logger.debug(`  👥 Total Obligations:   ${totalObligations}`);
  logger.debug(`  💸 Fee Receiver:        ${feeReceiver}`);
  logger.debug(`  🚫 Bad Debt (USD):      ${badDebtUsd}`);
  logger.debug(`  💰 Bad Debt Limit (USD):${badDebtLimitUsd}`);

  if (client.pythClient?.pythStateId || client.pythClient?.wormholeStateId) {
    logger.debug("🧠 Pyth Oracle Info:");
    const pythStateId = client.pythClient.pythStateId || "No Pyth State ID";
    const wormholeStateId = client.pythClient.wormholeStateId || "No Wormhole State ID";
    const wsEndpoint = client.pythConnection?.wsEndpoint || "No WS Endpoint";

    logger.debug(`  🔗 Pyth State ID:       ${pythStateId}`);
    logger.debug(`  🌉 Wormhole State ID:   ${wormholeStateId}`);
    logger.debug(`  📡 WS Endpoint:         ${wsEndpoint}`);
  } else {
    logger.debug("⚠️ Pyth oracle info not available.");
  }
}



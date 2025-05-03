import winston from "winston";
import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Utility: format a Uint8Array/Buffer as a compact hex snippet
export function hexSnippet(bytes: Uint8Array, snippetLen = 8): string {
  const hex = Buffer.from(bytes).toString("hex");
  if (hex.length <= snippetLen * 4) return `0x${hex}`;
  return `0x${hex.slice(0, snippetLen * 2)}…${hex.slice(-snippetLen * 2)}`;
}

// Define the log level based on the environment variable (default to 'info' if not set)
const logLevel = process.env.LOG_LEVEL || 'info';

// Create the winston logger
const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),  // Log to console
  ],
});

export default logger;

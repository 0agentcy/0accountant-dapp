# **0Accountant DApp**

**A decentralized finance (DeFi) assistant on SUI**

This project provides both a **CLI/backend** and a **web frontend** to help users deploy, simulate, and withdraw DeFi strategies on the SUI blockchain via the Suilend protocol.

---

## **Table of Contents**

1. Features

2. Architecture

3. Prerequisites

4. Getting Started

   * Backend CLI

   * Backend Server (API)

   * Frontend Web App

5. Environment Variables

6. Usage

7. Development

8. Testing

9. Project Structure

10. Contributing

---

## **Features**

* 🚀 **Automated Strategy Runner**: Deposit (`lend`), withdraw, and swap actions via CLI or API.

* 🔍 **Dry-run Simulation**: Preview transactions before committing on-chain.

* ⏳ **Time-bound Strategies**: Lend assets for a specified duration and automatically withdraw.

* 💬 **Interactive Chat UI**: Frontend uses AI-powered chat to craft and execute strategies.

* 📊 **Real-time Pricing**: Fetch and cache on-chain `PriceInfo` per reserve.

---

## **Architecture**

* **CLI (**\`\`**)**: TypeScript script to execute `--lend`, `--withdraw`, `--swap`, and `--duration` flags.

* **Backend API (**\`\`**)**: Express server exposing `/execute` endpoint for frontend integration.

* **Strategy Runner (**\`\`**)**: Core logic to build and execute Sui transaction blocks.

* **Action Handlers**: Modular `actions/deposit.ts`, `actions/withdraw.ts`, easily extended for new protocols.

* **Pricing Utility (**\`\`**)**: Paginates dynamic fields to collect `PriceInfo` objects.

* **Frontend React App**: Chat-based UI built with Vite, Tailwind, and Mysten DApp Kit.

---

## **Prerequisites**

* **Node.js** v18+

* **npm** v9+

* **SUI Testnet/Mainnet Access**: A Sui RPC endpoint

* **Environment Variables** (see below)

---

## **Getting Started**

### **Backend CLI**

\# Install dependencies  
npm install

\# Dry-run lend 1 SUI  
npx tsx src/index.ts \--lend \--duration=5

\# Live lend  
npx tsx src/index.ts \--lend \--duration=5 \--no-dry-run

### **Backend Server (API) (API)**

\# Start API server  
yarn start:server  
\# Listen on http://localhost:3001

\# Example cURL  
tcurl \-X POST http://localhost:3001/execute \\  
  \-H 'Content-Type: application/json' \\  
  \-d '{"coinType":"0x2::sui::SUI","amount":1000000000,"dryRun":true}'

### **Frontend Web App**

\# Navigate to frontend  
yarn \--cwd frontend install  
\# Start dev server  
yarn \--cwd frontend dev  
\# Open http://localhost:3000

---

## **Environment Variables**

Create a `.env` file in `backend/` with:

PRIVATE\_KEY=\<your SUI private key\>  
SUI\_PACKAGE\_ID=\<sui wallet package ID\>  
LENDING\_MARKET\_OBJ=\<Suilend market object ID\>  
LENDING\_MARKET\_TYPE=\<Suilend market type\>  
COIN\_TYPE=0x2::sui::SUI  
DRY\_RUN=true  
PORT=3001  
LOG\_LEVEL=debug

---

## **Usage**

1. **Simulate a strategy** to verify logic and no funds are moved.

2. **Execute live** once satisfied; transactions are irreversible on-chain.

3. **Frontend** guides you through via AI chat interactions.

---

## **Development**

* **Linting & Formatting**: ESLint \+ Prettier configured; run `yarn lint`.

* **Type-check**: `yarn tsc --noEmit`.

* **IDE**: VSCode recommended with TypeScript tooling.

---

## **Testing**

*No formal tests yet.* Future roadmap includes:

* Unit tests for `fetchReserves.ts`, action handlers.

* Integration tests running dry-runs on Sui testnet.

---

## **Project Structure**

0accountant-dapp  
├── backend  
│   ├── src  
│   │   ├── lib  
│   │   │   ├── actions  
│   │   │   │   ├── deposit.ts  
│   │   │   │   └── withdraw.ts  
│   │   │   ├── runStrategy.ts  
│   │   │   └── types.ts  
│   │   ├── utils  
│   │   │   └── fetchReserves.ts  
│   │   ├── server.ts  
│   │   └── index.ts  
│   ├── package.json  
│   └── tsconfig.json  
└── frontend  
    ├── src  
    │   ├── components  
    │   ├── screens  
    │   └── App.tsx  
    ├── package.json  
    └── vite.config.ts

---

## **Contributing**

Contributions welcome\! Please:

1. Fork the repo

2. Create a feature branch

3. Open a pull request with clear description
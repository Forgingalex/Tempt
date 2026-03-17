-- CreateEnum
CREATE TYPE "TradeAgentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DELISTED', 'SLASHED');

-- CreateEnum
CREATE TYPE "TradeType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "VaultTxType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRADE_DEBIT', 'TRADE_CREDIT');

-- CreateTable
CREATE TABLE "TradeableAgent" (
    "id" TEXT NOT NULL,
    "onChainAgentId" INTEGER NOT NULL,
    "creator" TEXT NOT NULL,
    "metadataUri" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "shareTokenAddress" TEXT,
    "supplyCap" TEXT NOT NULL,
    "bondAmount" TEXT NOT NULL,
    "creatorFeeBps" INTEGER NOT NULL,
    "status" "TradeAgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPrice" TEXT NOT NULL DEFAULT '0',
    "currentSupply" TEXT NOT NULL DEFAULT '0',
    "reserveBalance" TEXT NOT NULL DEFAULT '0',
    "totalVolume" TEXT NOT NULL DEFAULT '0',
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "holders" INTEGER NOT NULL DEFAULT 0,
    "priceChange24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeableAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "trader" TEXT NOT NULL,
    "type" "TradeType" NOT NULL,
    "stableAmount" TEXT NOT NULL,
    "shareAmount" TEXT NOT NULL,
    "pricePerShare" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "fee" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultBalance" (
    "id" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "balance" TEXT NOT NULL DEFAULT '0',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultTransaction" (
    "id" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "type" "VaultTxType" NOT NULL,
    "txHash" TEXT NOT NULL,
    "agentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TradeableAgent_onChainAgentId_key" ON "TradeableAgent"("onChainAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_txHash_key" ON "Trade"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "VaultBalance_user_token_key" ON "VaultBalance"("user", "token");

-- CreateIndex
CREATE UNIQUE INDEX "VaultTransaction_txHash_key" ON "VaultTransaction"("txHash");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "TradeableAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

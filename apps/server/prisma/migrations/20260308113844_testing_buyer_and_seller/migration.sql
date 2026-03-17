-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BUYER', 'SELLER', 'BOTH', 'ADMIN');

-- CreateEnum
CREATE TYPE "AgentCategory" AS ENUM ('WRITING', 'CODING', 'ART', 'AUTOMATION', 'RESEARCH', 'OTHER');

-- CreateEnum
CREATE TYPE "OutputFormat" AS ENUM ('TEXT', 'MARKDOWN', 'CODE', 'JSON', 'STRUCTURED');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('ONE_TIME', 'USAGE_BASED');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'LISTED', 'DELISTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('ESCROWED', 'ACCEPTED', 'DISPUTED', 'REFUNDED', 'AUTO_RELEASED');

-- CreateEnum
CREATE TYPE "ClaimResult" AS ENUM ('YES', 'PARTIALLY', 'NO');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'BUYER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "onChainId" INTEGER,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "doesNotDo" TEXT NOT NULL,
    "category" "AgentCategory" NOT NULL,
    "tags" TEXT[],
    "encryptedPrompt" TEXT NOT NULL,
    "promptTemplate" TEXT,
    "inputs" JSONB NOT NULL,
    "outputFormat" "OutputFormat" NOT NULL,
    "demos" JSONB NOT NULL,
    "price" BIGINT NOT NULL,
    "paymentToken" TEXT NOT NULL,
    "licenseType" "LicenseType" NOT NULL,
    "usageLimit" INTEGER,
    "llmProvider" TEXT NOT NULL,
    "llmModel" TEXT NOT NULL,
    "maxTokens" INTEGER NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "totalExecutions" INTEGER NOT NULL DEFAULT 0,
    "acceptanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "disputeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "repeatBuyerRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "escrowId" INTEGER,
    "txHash" TEXT,
    "agentId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "paymentToken" TEXT NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'ESCROWED',
    "usagesRemaining" INTEGER,
    "autoReleaseAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outputHash" TEXT NOT NULL,
    "rawInput" TEXT,
    "rawOutput" TEXT,
    "durationMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "didWhatItClaimed" "ClaimResult" NOT NULL,
    "wasSetupClear" BOOLEAN NOT NULL,
    "wouldUseAgain" BOOLEAN NOT NULL,
    "whatWorked" TEXT,
    "whatDidnt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentVersion" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "changelog" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_onChainId_key" ON "Agent"("onChainId");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_slug_key" ON "Agent"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_escrowId_key" ON "Purchase"("escrowId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_purchaseId_key" ON "Review"("purchaseId");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentVersion" ADD CONSTRAINT "AgentVersion_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TECH', 'READONLY');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BillingSource" AS ENUM ('SYNCRO', 'MANUAL');

-- CreateEnum
CREATE TYPE "BillingFrequency" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "LicenseSource" AS ENUM ('PAX8');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('LICENSE_QTY_MISMATCH', 'UNBILLED_LICENSE', 'BELOW_PRICE_FLOOR', 'NO_BILLING');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "SyncSource" AS ENUM ('SYNCRO', 'PAX8');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ProspectPriority" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('NOT_CONTACTED', 'RESEARCHING', 'CONTACTED', 'MEETING_SET', 'ASSESSMENT_DONE', 'PROPOSAL_SENT', 'WON', 'LOST', 'NOT_A_FIT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'READONLY',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "syncroCustomerId" TEXT,
    "pax8CompanyId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingLine" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sku" TEXT,
    "source" "BillingSource" NOT NULL,
    "frequency" "BillingFrequency" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "externalId" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BillingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseSubscription" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "source" "LicenseSource" NOT NULL DEFAULT 'PAX8',
    "productName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCostCents" INTEGER NOT NULL,
    "billingTerm" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LicenseSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkuMapping" (
    "id" TEXT NOT NULL,
    "pax8Sku" TEXT NOT NULL,
    "billingDescription" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkuMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "syncroAssetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceType" TEXT,
    "lastSeenAt" TIMESTAMPTZ(3),

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationIssue" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "IssueType" NOT NULL,
    "key" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "source" "SyncSource" NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "recordsRead" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "segment" TEXT,
    "area" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "priority" "ProspectPriority" NOT NULL DEFAULT 'C',
    "status" "ProspectStatus" NOT NULL DEFAULT 'NOT_CONTACTED',
    "owner" TEXT,
    "lastContactAt" TIMESTAMPTZ(3),
    "nextStep" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_syncroCustomerId_key" ON "Client"("syncroCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_pax8CompanyId_key" ON "Client"("pax8CompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingLine_externalId_key" ON "BillingLine"("externalId");

-- CreateIndex
CREATE INDEX "BillingLine_clientId_idx" ON "BillingLine"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseSubscription_externalId_key" ON "LicenseSubscription"("externalId");

-- CreateIndex
CREATE INDEX "LicenseSubscription_clientId_idx" ON "LicenseSubscription"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "SkuMapping_pax8Sku_key" ON "SkuMapping"("pax8Sku");

-- CreateIndex
CREATE UNIQUE INDEX "Device_syncroAssetId_key" ON "Device"("syncroAssetId");

-- CreateIndex
CREATE INDEX "Device_clientId_idx" ON "Device"("clientId");

-- CreateIndex
CREATE INDEX "ReconciliationIssue_clientId_type_key_status_idx" ON "ReconciliationIssue"("clientId", "type", "key", "status");

-- CreateIndex
CREATE INDEX "ReconciliationIssue_status_idx" ON "ReconciliationIssue"("status");

-- CreateIndex
CREATE INDEX "SyncRun_startedAt_idx" ON "SyncRun"("startedAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "BillingLine" ADD CONSTRAINT "BillingLine_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseSubscription" ADD CONSTRAINT "LicenseSubscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationIssue" ADD CONSTRAINT "ReconciliationIssue_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationIssue" ADD CONSTRAINT "ReconciliationIssue_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

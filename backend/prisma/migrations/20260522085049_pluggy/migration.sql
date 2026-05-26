-- AlterTable: adiciona externalId em Income
ALTER TABLE "Income" ADD COLUMN "externalId" TEXT;

-- AlterTable: adiciona externalId em Expense
ALTER TABLE "Expense" ADD COLUMN "externalId" TEXT;

-- CreateTable: BankConnection
CREATE TABLE "BankConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "lastSync" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex: itemId único
CREATE UNIQUE INDEX "BankConnection_itemId_key" ON "BankConnection"("itemId");

-- CreateIndex: userId em BankConnection
CREATE INDEX "BankConnection_userId_idx" ON "BankConnection"("userId");

-- CreateIndex: externalId em Income
CREATE INDEX "Income_userId_externalId_idx" ON "Income"("userId", "externalId");

-- CreateIndex: externalId em Expense
CREATE INDEX "Expense_userId_externalId_idx" ON "Expense"("userId", "externalId");

-- AlterTable: adiciona budget em Category
ALTER TABLE "Category" ADD COLUMN "budget" REAL;

-- CreateTable: FixedExpense
CREATE TABLE "FixedExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" REAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startMonth" TEXT,
    "endMonth" TEXT,
    "autoLinkName" TEXT,
    "autoLinkAmount" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FixedExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FixedExpense_userId_idx" ON "FixedExpense"("userId");

-- CreateTable: FixedExpensePayment
CREATE TABLE "FixedExpensePayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fixedExpenseId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "expenseId" TEXT,
    "autoCreated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FixedExpensePayment_fixedExpenseId_fkey" FOREIGN KEY ("fixedExpenseId") REFERENCES "FixedExpense" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FixedExpensePayment_fixedExpenseId_month_key" ON "FixedExpensePayment"("fixedExpenseId", "month");

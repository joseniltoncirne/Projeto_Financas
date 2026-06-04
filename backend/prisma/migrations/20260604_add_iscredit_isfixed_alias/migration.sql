-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "isCredit" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "isFixed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Alias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    CONSTRAINT "Alias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Alias_userId_normalizedName_key" ON "Alias"("userId", "normalizedName");

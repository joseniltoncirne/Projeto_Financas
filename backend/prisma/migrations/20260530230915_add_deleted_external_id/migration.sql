-- CreateTable: registro de externalIds que o usuário excluiu (tombstone)
-- Usado pelo sync para não re-importar o que já foi propositalmente removido.
CREATE TABLE "DeletedExternalId" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "bank" TEXT NOT NULL,
    "dateStr" TEXT,
    "month" TEXT NOT NULL,
    "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeletedExternalId_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex: par (usuário, externalId) é único — garante idempotência ao "tombstonar"
-- o mesmo externalId várias vezes (não acontece, mas defesa em profundidade)
CREATE UNIQUE INDEX "DeletedExternalId_userId_externalId_key" ON "DeletedExternalId"("userId", "externalId");

-- CreateIndex: lookup rápido por usuário
CREATE INDEX "DeletedExternalId_userId_idx" ON "DeletedExternalId"("userId");

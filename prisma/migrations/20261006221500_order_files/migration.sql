-- CreateTable
CREATE TABLE "OrderFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT,
    "orderItemId" TEXT,
    "fieldId" TEXT NOT NULL DEFAULT '',
    "filename" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderFile_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderFile_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OrderFile_orderId_idx" ON "OrderFile"("orderId");

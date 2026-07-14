-- CreateIndex
CREATE INDEX "Product_variantMatch_idx" ON "Product"("variantMatch");

-- CreateIndex
CREATE INDEX "Product_xmlSourceId_idx" ON "Product"("xmlSourceId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Variant_name_idx" ON "Variant"("name");

-- CreateIndex
CREATE INDEX "Variant_productId_idx" ON "Variant"("productId");

// Mevcut ürünlerin xmlSourceId'sini güncelle
// Bu script, daha önce sync edilmiş ama xmlSourceId null olan ürünleri düzeltir
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 xmlSourceId null olan ürünler taranıyor...');
  
  // xmlSourceId null olan ürünleri bul
  const products = await prisma.product.findMany({
    where: { xmlSourceId: null },
    select: { id: true, xmlKey: true, title: true },
  });
  
  console.log(`📦 Toplam ${products.length} ürünün xmlSourceId null`);
  
  if (products.length === 0) {
    console.log('✅ Tüm ürünler zaten xmlSourceId ile bağlı');
    return;
  }
  
  // Her ürün için import run'ları kontrol et
  let fixedCount = 0;
  for (const product of products) {
    if (!product.xmlKey) continue;
    
    // Bu xmlKey ile import edilmiş kayıtları bul
    const importItem = await prisma.xmlImportItemResult.findFirst({
      where: { xmlKey: product.xmlKey },
      include: { importRun: true },
    });
    
    if (importItem?.importRun?.sourceId) {
      await prisma.product.update({
        where: { id: product.id },
        data: { xmlSourceId: importItem.importRun.sourceId },
      });
      fixedCount++;
      console.log(`  ✓ ${product.title || product.xmlKey} → sourceId: ${importItem.importRun.sourceId}`);
    }
  }
  
  console.log(`\n✅ ${fixedCount} ürün düzeltildi`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

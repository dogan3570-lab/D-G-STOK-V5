import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== VERITABANI TEMIZLIGI BASLIYOR ===');
  
  // Sırayla sil (foreign key ilişkileri için)
  console.log('1. Variantlar siliniyor...');
  const v = await prisma.variant.deleteMany({});
  console.log('   Silinen:', v.count);
  
  console.log('2. ProductMarketplaceState siliniyor...');
  const pms = await prisma.productMarketplaceState.deleteMany({});
  console.log('   Silinen:', pms.count);
  
  console.log('3. XmlImportItemResult siliniyor...');
  const iir = await prisma.xmlImportItemResult.deleteMany({});
  console.log('   Silinen:', iir.count);
  
  console.log('4. XmlImportRun siliniyor...');
  const ir = await prisma.xmlImportRun.deleteMany({});
  console.log('   Silinen:', ir.count);
  
  console.log('5. Ürünler siliniyor...');
  const p = await prisma.product.deleteMany({});
  console.log('   Silinen:', p.count);
  
  console.log('6. Kategoriler siliniyor...');
  const c = await prisma.category.deleteMany({});
  console.log('   Silinen:', c.count);
  
  console.log('7. Markalar siliniyor...');
  const b = await prisma.brand.deleteMany({});
  console.log('   Silinen:', b.count);
  
  console.log('=== TEMIZLIK TAMAMLANDI ===');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });

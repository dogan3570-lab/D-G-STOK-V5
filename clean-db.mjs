import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Eski test ürünlerini temizle (xmlSourceId'si null olanlar)
  const deleted = await prisma.product.deleteMany({
    where: { xmlSourceId: null }
  });
  console.log('Deleted old products:', deleted.count);
  
  // Import item results'ları temizle
  const deletedItems = await prisma.xmlImportItemResult.deleteMany({});
  console.log('Deleted import items:', deletedItems.count);
  
  // Import run'ları temizle
  const deletedRuns = await prisma.xmlImportRun.deleteMany({});
  console.log('Deleted import runs:', deletedRuns.count);
  
  await prisma.$disconnect();
}

main().catch(console.error);

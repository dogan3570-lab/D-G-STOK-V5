import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sources = await prisma.xmlSource.findMany();
  console.log('XML Sources:', JSON.stringify(sources, null, 2));
  
  const productCount = await prisma.product.count();
  console.log('Products count:', productCount);
  
  const products = await prisma.product.findMany({ take: 5 });
  console.log('First 5 products:', JSON.stringify(products, null, 2));
  
  const runs = await prisma.xmlImportRun.findMany();
  console.log('Import runs:', JSON.stringify(runs, null, 2));
  
  const itemCount = await prisma.xmlImportItemResult.count();
  console.log('Import item results count:', itemCount);
  
  const items = await prisma.xmlImportItemResult.findMany({ take: 5 });
  console.log('First 5 items:', JSON.stringify(items, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);

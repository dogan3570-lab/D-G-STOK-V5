import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const source = await prisma.xmlSource.findFirst();
  
  const response = await fetch(source.url, { redirect: 'follow' });
  const text = await response.text();
  
  // İlk ürünün tam yapısını görelim
  const productMatch = text.match(/<product>([\s\S]*?)<\/product>/);
  if (productMatch) {
    console.log('=== FIRST PRODUCT STRUCTURE ===');
    console.log(productMatch[1].substring(0, 2000));
  }
  
  // Tüm etiketleri bulalım
  const tags = new Set();
  const tagRegex = /<(\w+)[ >]/g;
  let m;
  while ((m = tagRegex.exec(text)) !== null) {
    tags.add(m[1]);
  }
  console.log('\n=== ALL XML TAGS ===');
  console.log([...tags].sort().join(', '));
  
  await prisma.$disconnect();
}

main().catch(console.error);

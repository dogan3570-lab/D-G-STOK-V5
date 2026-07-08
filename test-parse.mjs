import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const source = await prisma.xmlSource.findFirst();
  
  const response = await fetch(source.url, { redirect: 'follow' });
  const xml = await response.text();
  
  // Test parse
  const productRegex = /<(product|item)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const matches = Array.from(xml.matchAll(productRegex));
  console.log('Total products in XML:', matches.length);
  
  // İlk 3 ürünü parse et
  for (let i = 0; i < Math.min(3, matches.length); i++) {
    const content = matches[i][2];
    
    function extractTagValue(content, tagName) {
      const regex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
      const match = regex.exec(content);
      if (!match) return null;
      return match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
    }
    
    const id = extractTagValue(content, 'id');
    const name = extractTagValue(content, 'name');
    const productCode = extractTagValue(content, 'productCode');
    const barcode = extractTagValue(content, 'barcode');
    const quantity = extractTagValue(content, 'quantity');
    const price = extractTagValue(content, 'price');
    const brand = extractTagValue(content, 'brand');
    
    console.log(`\n--- Product ${i + 1} ---`);
    console.log('id:', id);
    console.log('name:', name);
    console.log('productCode:', productCode);
    console.log('barcode:', barcode);
    console.log('quantity:', quantity);
    console.log('price:', price);
    console.log('brand:', brand);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);

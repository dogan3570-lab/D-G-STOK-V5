import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const source = await prisma.xmlSource.findFirst();
  console.log('Source URL:', source.url);
  
  try {
    const response = await fetch(source.url, { redirect: 'follow' });
    console.log('Response status:', response.status);
    const text = await response.text();
    console.log('Response length:', text.length);
    console.log('First 500 chars:', text.substring(0, 500));
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);

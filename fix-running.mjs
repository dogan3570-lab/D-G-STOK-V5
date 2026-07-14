import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fix() {
  // Takılı kalan "running" import run'larını temizle
  const result = await prisma.xmlImportRun.updateMany({
    where: { status: 'running' },
    data: { 
      status: 'failed', 
      finishedAt: new Date(), 
      failedProducts: 1,
      durationMs: 0
    }
  });
  
  console.log(`Temizlenen takılı run sayısı: ${result.count}`);
  
  // Son durumu kontrol et
  const runs = await prisma.xmlImportRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 3
  });
  
  console.log('\nSon 3 Import Run Durumu:');
  for (const r of runs) {
    console.log(`  [${r.status}] ${r.startedAt} -> ${r.finishedAt || 'Devam'}`);
  }
  
  await prisma.$disconnect();
}

fix().catch(console.error);

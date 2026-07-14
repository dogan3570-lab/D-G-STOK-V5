import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function monitor() {
  console.log('=== XML IMPORT İZLEME ===\n');
  
  let lastCount = 0;
  let sameCount = 0;
  
  for (let i = 0; i < 60; i++) {
    const total = await prisma.product.count();
    const run = await prisma.xmlImportRun.findFirst({ 
      where: { status: 'running' },
      orderBy: { startedAt: 'desc' } 
    });
    
    const change = total - lastCount;
    const changeStr = change > 0 ? `+${change}` : change < 0 ? `${change}` : ' 0';
    
    if (run) {
      console.log(`[${String(i+1).padStart(2, '0')}s] Ürün: ${String(total).padStart(6)} (${changeStr}) | Run: ${run.newProducts}/${run.totalProducts}`);
    } else {
      // Son run'ı kontrol et
      const lastRun = await prisma.xmlImportRun.findFirst({ orderBy: { startedAt: 'desc' } });
      if (lastRun?.status === 'completed') {
        console.log(`[${String(i+1).padStart(2, '0')}s] ✅ TAMAMLANDI! Ürün: ${total} | Süre: ${(lastRun.durationMs/1000).toFixed(1)}s`);
        break;
      }
      console.log(`[${String(i+1).padStart(2, '0')}s] Ürün: ${String(total).padStart(6)} (${changeStr}) | Bekliyor...`);
    }
    
    if (change === 0) {
      sameCount++;
      if (sameCount > 5) {
        console.log('\n⚠️  Ürün sayısı değişmiyor, sync tamamlanmış olabilir');
        break;
      }
    } else {
      sameCount = 0;
    }
    
    lastCount = total;
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Son durum
  const finalTotal = await prisma.product.count();
  const finalRun = await prisma.xmlImportRun.findFirst({ orderBy: { startedAt: 'desc' } });
  console.log(`\n=== SON DURUM ===`);
  console.log(`Toplam Ürün: ${finalTotal}`);
  console.log(`Son Run: [${finalRun?.status}] ${finalRun?.newProducts} yeni, ${finalRun?.updatedProducts} güncel`);
  if (finalRun?.durationMs) {
    console.log(`Süre: ${(finalRun.durationMs/1000).toFixed(1)}s`);
  }
  
  await prisma.$disconnect();
}

monitor().catch(console.error);

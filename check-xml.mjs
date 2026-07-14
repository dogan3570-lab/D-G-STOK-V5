import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  console.log('=== XML IMPORT DURUM KONTROLÜ ===\n');

  // XML kaynaklarını kontrol et
  const sources = await prisma.xmlSource.findMany();
  console.log(`XML Kaynak Sayısı: ${sources.length}`);
  for (const s of sources) {
    console.log(`  - ${s.name} (${s.sourceType}) | Aktif: ${s.active} | URL: ${s.url?.substring(0, 50)}...`);
    console.log(`    Son Çalışma: ${s.lastRunAt || 'Hiç'}`);
    console.log(`    Son Hata: ${s.lastError || 'Yok'}`);
  }

  // Ürün sayısını kontrol et
  const totalProducts = await prisma.product.count();
  const linkedProducts = await prisma.product.count({ where: { xmlSourceId: { not: null } } });
  const unlinkedProducts = await prisma.product.count({ where: { xmlSourceId: null } });
  
  console.log(`\nÜrün Durumu:`);
  console.log(`  Toplam Ürün: ${totalProducts}`);
  console.log(`  XML bağlantılı: ${linkedProducts}`);
  console.log(`  Bağlantısız: ${unlinkedProducts}`);

  // Import run'ları
  const runs = await prisma.xmlImportRun.findMany({ 
    orderBy: { startedAt: 'desc' }, 
    take: 5,
    include: { source: { select: { name: true } } }
  });
  
  console.log(`\nSon ${runs.length} Import Run:`);
  for (const r of runs) {
    console.log(`  [${r.status}] ${r.source?.name || 'Bilinmeyen'} - ${r.totalProducts} ürün`);
    console.log(`    Yeni: ${r.newProducts || 0} | Güncellenen: ${r.updatedProducts || 0} | Başarısız: ${r.failedProducts || 0}`);
    console.log(`    Başlangıç: ${r.startedAt} | Bitiş: ${r.finishedAt || 'Devam ediyor'}`);
  }

  // Örnek ürünler
  const sampleProducts = await prisma.product.findMany({ take: 3, orderBy: { createdAt: 'desc' } });
  console.log(`\nÖrnek Ürünler (son 3):`);
  for (const p of sampleProducts) {
    console.log(`  - ${p.title?.substring(0, 50)} | xmlKey: ${p.xmlKey} | Stok: ${p.stock} | Fiyat: ${p.salePrice}`);
    console.log(`    xmlSourceId: ${p.xmlSourceId || 'BAĞLANTISIZ!'}`);
  }

  await prisma.$disconnect();
}

check().catch(console.error);

// XML Sync Test - Ürünlerin veritabanına yazıldığını doğrula
const BASE = 'http://localhost:4000';

async function test() {
  console.log('=== XML SYNC TEST ===\n');
  
  // 1. Login
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@dgstok.com', password: 'admin123' }),
  });
  const login = await loginRes.json();
  const cookie = loginRes.headers.get('set-cookie')?.split(';')[0] || '';
  console.log('✅ Login:', login.ok ? 'Başarılı' : 'Başarısız');

  // 2. XML kaynaklarını listele
  const sources = await (await fetch(`${BASE}/xml-sources`, {
    headers: { Cookie: cookie }
  })).json();
  console.log(`\n📦 XML Kaynakları: ${sources.items?.length || 0} adet`);
  
  if (!sources.items?.length) {
    console.log('❌ XML kaynağı bulunamadı!');
    return;
  }

  const source = sources.items[0];
  console.log(`   Kaynak: ${source.name} (${source.id})`);
  console.log(`   Ürün Sayısı: ${source.productCount}`);
  console.log(`   Son Çalışma: ${source.lastRunAt || 'Hiç'}`);

  // 3. Sync tetikle
  console.log('\n🔄 Sync tetikleniyor...');
  const startTime = Date.now();
  
  try {
    const syncRes = await fetch(`${BASE}/xml-sources/${source.id}/sync`, {
      method: 'POST',
      headers: { Cookie: cookie }
    });
    const syncResult = await syncRes.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\n✅ Sync tamamlandı! (${duration}s)`);
    console.log(`   İçe aktarılan: ${syncResult.importedCount}`);
    console.log(`   Güncellenen: ${syncResult.updatedCount}`);
    console.log(`   Toplam: ${syncResult.totalItems}`);
    console.log(`   Run ID: ${syncResult.runId}`);
    
    // 4. Veritabanını kontrol et
    console.log('\n🔍 Veritabanı kontrolü...');
    
    // Dashboard stats
    const stats = await (await fetch(`${BASE}/dashboard/stats`, {
      headers: { Cookie: cookie }
    })).json();
    console.log(`   Toplam Ürün: ${stats.totalProducts}`);
    console.log(`   XML Kaynakları: ${stats.totalXmlSources}`);
    
    // Son ürünleri kontrol et
    const products = await (await fetch(`${BASE}/products?limit=3`, {
      headers: { Cookie: cookie }
    })).json();
    
    if (products.items?.length > 0) {
      console.log(`\n📋 Son 3 Ürün:`);
      for (const p of products.items.slice(0, 3)) {
        console.log(`   - ${p.title?.substring(0, 60)}`);
        console.log(`     Stok: ${p.stock} | Fiyat: ${p.salePrice} | xmlKey: ${p.xmlKey}`);
        console.log(`     xmlSourceId: ${p.xmlSourceId || '❌ BAĞLANTISIZ!'}`);
      }
    }
    
    // 5. Import run history
    const history = await (await fetch(`${BASE}/xml-sources/${source.id}/history?limit=3`, {
      headers: { Cookie: cookie }
    })).json();
    
    if (history.items?.length > 0) {
      console.log(`\n📊 Son Import Runları:`);
      for (const r of history.items.slice(0, 3)) {
        console.log(`   [${r.status}] ${new Date(r.startedAt).toLocaleTimeString()}`);
        console.log(`     Yeni: ${r.newProducts || 0} | Günc: ${r.updatedProducts || 0} | Baş: ${r.failedProducts || 0}`);
        console.log(`     Süre: ${r.durationMs ? (r.durationMs/1000).toFixed(1) + 's' : 'N/A'}`);
      }
    }
    
    console.log('\n✅ TEST BAŞARILI!');
    
  } catch (err) {
    console.log(`\n❌ Sync hatası: ${err.message}`);
  }
}

test();

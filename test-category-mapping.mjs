// Kategori Eşleştirme API Test Scripti
import http from 'http';

const BASE = 'http://localhost:4000';
let cookie = '';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      }
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  console.log('🔧 Kategori Eşleştirme API Testi\n');
  console.log('='.repeat(60));

  // 1. Login
  console.log('\n📌 1. Giriş yapılıyor...');
  const login = await request('POST', '/auth/login', { email: 'admin@dgstok.com', password: 'admin123' });
  console.log(`   Durum: ${login.status} - ${login.data?.user?.email || 'HATA'}`);

  // 2. Kategorileri listele
  console.log('\n📌 2. Kategoriler listeleniyor...');
  const cats = await request('GET', '/categories');
  console.log(`   Durum: ${cats.status} - ${cats.data?.items?.length || 0} kategori bulundu`);

  // 3. Eşleşmemiş ürünleri getir
  console.log('\n📌 3. Eşleşmemiş ürünler getiriliyor...');
  const unmatched = await request('GET', '/categories/unmatched-products?limit=5');
  console.log(`   Durum: ${unmatched.status} - ${unmatched.data?.pagination?.total || 0} eşleşmemiş ürün`);
  if (unmatched.data?.items?.length > 0) {
    console.log(`   İlk ürün: ${unmatched.data.items[0].title || unmatched.data.items[0].xmlKey}`);
  }

  // 4. Eşleştirme haritasını getir
  console.log('\n📌 4. Eşleştirme haritası getiriliyor...');
  const mappings = await request('GET', '/categories/mappings');
  console.log(`   Durum: ${mappings.status} - ${mappings.data?.items?.length || 0} eşleştirme`);

  // 5. Yeni kategori oluştur
  console.log('\n📌 5. Yeni kategori oluşturuluyor...');
  const newCat = await request('POST', '/categories', { name: 'Test Kategori ' + Date.now() });
  console.log(`   Durum: ${newCat.status} - ${newCat.data?.name || 'HATA'}`);

  // 6. Pazaryerlerini getir
  console.log('\n📌 6. Pazaryerleri getiriliyor...');
  const mps = await request('GET', '/marketplaces');
  console.log(`   Durum: ${mps.status} - ${mps.data?.items?.length || 0} pazaryeri`);

  // 7. Yeni eşleştirme oluştur (eğer kategori ve pazaryeri varsa)
  if (newCat.data?.id && mps.data?.items?.[0]) {
    console.log('\n📌 7. Yeni eşleştirme oluşturuluyor...');
    const newMapping = await request('POST', '/categories/mappings', {
      categoryId: newCat.data.id,
      marketplaceId: mps.data.items[0].id,
      externalId: 'EXT-123',
      externalName: 'Harici Kategori',
      externalPath: 'Ana > Alt > Test',
      source: 'manual',
    });
    console.log(`   Durum: ${newMapping.status} - ${newMapping.data?.id ? '✅ Oluşturuldu' : 'HATA'}`);

    // 8. Eşleştirmeyi güncelle
    if (newMapping.data?.id) {
      console.log('\n📌 8. Eşleştirme güncelleniyor...');
      const update = await request('PUT', `/categories/mappings/${newMapping.data.id}`, {
        externalName: 'Güncellenmiş Kategori',
        confidence: 0.95,
      });
      console.log(`   Durum: ${update.status} - ${update.data?.externalName || 'HATA'}`);

      // 9. Eşleştirmeyi sil
      console.log('\n📌 9. Eşleştirme siliniyor...');
      const del = await request('DELETE', `/categories/mappings/${newMapping.data.id}`);
      console.log(`   Durum: ${del.status} - ${del.status === 204 ? '✅ Silindi' : 'HATA'}`);
    }
  }

  // 10. Otomatik eşleştirme testi
  console.log('\n📌 10. Otomatik eşleştirme test ediliyor...');
  const auto = await request('POST', '/categories/auto-match', {});
  console.log(`   Durum: ${auto.status} - ${auto.data?.message || 'HATA'}`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test tamamlandı!');
}

test().catch(console.error);

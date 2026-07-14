// Kapsamlı sistem test scripti
import http from 'http';

const BASE = 'http://localhost:4000';
let cookie = '';
let token = '';

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
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      timeout: 30000,
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
          resolve({ status: res.statusCode, data: data.substring(0, 200) });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
  return async () => {
    try {
      await fn();
      passed++;
      console.log(`  ✅ ${name}`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ name, error: msg });
      console.log(`  ❌ ${name}: ${msg}`);
    }
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log('\n🔍 DG STOK V5.0 - Kapsamlı Sistem Testi\n');
  console.log(`Hedef: ${BASE}\n`);

  // ============ 1. SAĞLIK KONTROLLERİ ============
  console.log('📋 1. Sağlık Kontrolleri');
  
  await test('Health check', async () => {
    const res = await request('GET', '/health');
    assert(res.status === 200, `Status ${res.status}`);
    assert(res.data?.ok === true, 'ok !== true');
  })();

  await test('API Status', async () => {
    const res = await request('GET', '/api-status');
    assert(res.status === 200, `Status ${res.status}`);
    assert(res.data?.status === 'ok', 'status !== ok');
  })();

  // ============ 2. AUTH ============
  console.log('\n📋 2. Kimlik Doğrulama');
  
  await test('Login with valid credentials', async () => {
    const res = await request('POST', '/auth/login', { email: 'admin@dgstok.com', password: 'admin123' });
    assert(res.status === 200, `Status ${res.status}`);
    assert(res.data?.ok === true, 'Login failed');
    token = res.data?.token || '';
    assert(token.length > 0, 'No token received');
  })();

  await test('Login with invalid credentials', async () => {
    const res = await request('POST', '/auth/login', { email: 'admin@dgstok.com', password: 'wrong' });
    assert(res.status === 401, `Status ${res.status}`);
  })();

  await test('Get current user (auth check)', async () => {
    const res = await request('GET', '/auth/me');
    assert(res.status === 200, `Status ${res.status}`);
    assert(res.data?.email === 'admin@dgstok.com', 'Wrong user');
  })();

  // ============ 3. VERİTABANI ============
  console.log('\n📋 3. Veritabanı İşlemleri');
  
  await test('Dashboard stats', async () => {
    const res = await request('GET', '/dashboard/stats');
    assert(res.status === 200, `Status ${res.status}`);
    assert(typeof res.data?.totalProducts === 'number', 'totalProducts missing');
    console.log(`     Toplam Ürün: ${res.data.totalProducts}`);
    console.log(`     XML Kaynakları: ${res.data.totalXmlSources}`);
  })();

  await test('List marketplaces', async () => {
    const res = await request('GET', '/marketplaces');
    assert(res.status === 200, `Status ${res.status}`);
    assert(Array.isArray(res.data?.items), 'items not array');
  })();

  await test('List XML sources', async () => {
    const res = await request('GET', '/xml-sources');
    assert(res.status === 200, `Status ${res.status}`);
    assert(Array.isArray(res.data?.items), 'items not array');
    if (res.data.items.length > 0) {
      console.log(`     Kaynak: ${res.data.items[0].name}, Ürün: ${res.data.items[0].productCount}`);
    }
  })();

  await test('List categories', async () => {
    const res = await request('GET', '/categories');
    assert(res.status === 200, `Status ${res.status}`);
    assert(Array.isArray(res.data?.items), 'items not array');
    console.log(`     Toplam Kategori: ${res.data.items.length}`);
  })();

  await test('List brands', async () => {
    const res = await request('GET', '/brands');
    assert(res.status === 200, `Status ${res.status}`);
    assert(Array.isArray(res.data?.items), 'items not array');
    console.log(`     Toplam Marka: ${res.data.items.length}`);
  })();

  await test('List products (paginated)', async () => {
    const res = await request('GET', '/products?page=1&limit=10');
    assert(res.status === 200, `Status ${res.status}`);
    assert(Array.isArray(res.data?.items), 'items not array');
    assert(res.data?.pagination?.total > 0, 'No products found');
    console.log(`     Toplam Ürün: ${res.data.pagination.total}`);
    console.log(`     Sayfa: ${res.data.pagination.page}/${res.data.pagination.totalPages}`);
  })();

  // ============ 4. KATEGORİ EŞLEŞTİRME ============
  console.log('\n📋 4. Kategori Eşleştirme');
  
  await test('Get category mappings', async () => {
    const res = await request('GET', '/categories/mappings');
    assert(res.status === 200, `Status ${res.status}`);
    assert(Array.isArray(res.data?.items), 'items not array');
  })();

  await test('Get unmatched products', async () => {
    const res = await request('GET', '/categories/unmatched-products?page=1&limit=10');
    assert(res.status === 200, `Status ${res.status}`);
    assert(Array.isArray(res.data?.items), 'items not array');
    console.log(`     Eşleşmemiş: ${res.data.pagination?.total || 0}`);
  })();

  // ============ 5. XML İŞLEMLERİ ============
  console.log('\n📋 5. XML İşlemleri');
  
  await test('Get XML source fields', async () => {
    const sources = await request('GET', '/xml-sources');
    if (sources.data?.items?.length > 0) {
      const id = sources.data.items[0].id;
      const res = await request('GET', `/xml-sources/${id}/fields`);
      assert(res.status === 200, `Status ${res.status}`);
      console.log(`     Alanlar: ${res.data?.fields?.length || 0}`);
    } else {
      console.log('     ⚠️ XML kaynağı yok, atlanıyor');
    }
  })();

  await test('Get XML source products', async () => {
    const sources = await request('GET', '/xml-sources');
    if (sources.data?.items?.length > 0) {
      const id = sources.data.items[0].id;
      const res = await request('GET', `/xml-sources/${id}/products?page=1&limit=5`);
      assert(res.status === 200, `Status ${res.status}`);
      assert(Array.isArray(res.data?.items), 'items not array');
      console.log(`     Kaynak Ürün: ${res.data.pagination?.total || 0}`);
    } else {
      console.log('     ⚠️ XML kaynağı yok, atlanıyor');
    }
  })();

  // ============ 6. CRUD İŞLEMLERİ ============
  console.log('\n📋 6. CRUD İşlemleri');
  
  let testCategoryId = '';
  
  await test('Create category', async () => {
    const res = await request('POST', '/categories', { 
      name: `Test Kategori ${Date.now()}` 
    });
    assert(res.status === 201, `Status ${res.status}`);
    assert(res.data?.item?.id, 'No id returned');
    testCategoryId = res.data.item.id;
  })();

  await test('Update category', async () => {
    if (!testCategoryId) throw new Error('No category to update');
    const res = await request('PUT', `/categories/${testCategoryId}`, { 
      name: `Güncellenmiş Test ${Date.now()}` 
    });
    assert(res.status === 200, `Status ${res.status}`);
  })();

  await test('Delete category', async () => {
    if (!testCategoryId) throw new Error('No category to delete');
    const res = await request('DELETE', `/categories/${testCategoryId}`);
    assert(res.status === 204, `Status ${res.status}`);
  })();

  // ============ 7. DİĞER ENDPOINT'LER ============
  console.log('\n📋 7. Diğer Endpoint\'ler');
  
  const endpoints = [
    ['GET', '/variants'],
    ['GET', '/orders'],
    ['GET', '/notifications'],
    ['GET', '/settings'],
    ['GET', '/templates'],
    ['GET', '/audit-logs?limit=5'],
    ['GET', '/dashboard/summary'],
  ];

  for (const [method, path] of endpoints) {
    await test(`${method} ${path}`, async () => {
      const res = await request(method, path);
      assert(res.status === 200, `Status ${res.status} for ${path}`);
    })();
  }

  // ============ 8. PERFORMANS TESTİ ============
  console.log('\n📋 8. Performans Testi');
  
  await test('Sequential requests (10x)', async () => {
    const start = Date.now();
    for (let i = 0; i < 10; i++) {
      const res = await request('GET', '/health');
      assert(res.status === 200, `Request ${i} failed`);
    }
    const duration = Date.now() - start;
    console.log(`     10 istek: ${duration}ms (ortalama ${duration/10}ms)`);
    assert(duration < 10000, `Too slow: ${duration}ms`);
  })();

  // ============ SONUÇ ============
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 TEST SONUÇLARI:`);
  console.log(`   ✅ Başarılı: ${passed}`);
  console.log(`   ❌ Başarısız: ${failed}`);
  console.log(`   📈 Toplam: ${passed + failed}`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  HATA DETAYLARI:');
    errors.forEach(e => console.log(`   - ${e.name}: ${e.error}`));
  }
  
  if (failed === 0) {
    console.log('\n🎉 TÜM TESTLER BAŞARILI! Sistem kararlı ve güvenli.');
  } else {
    console.log(`\n🔧 ${failed} test başarısız. Düzeltme gerekiyor.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n💥 KRİTİK HATA:', err);
  process.exit(1);
});

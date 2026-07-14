// Import debug scripti
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

async function main() {
  // Login
  const login = await request('POST', '/auth/login', { email: 'admin@dgstok.com', password: 'admin123' });
  console.log('Login:', login.status);

  // XML kaynaklarını listele
  const sources = await request('GET', '/xml-sources');
  console.log('\nXML Kaynakları:', JSON.stringify(sources.data, null, 2));

  // Ürün sayısını kontrol et
  const products = await request('GET', '/products?limit=5');
  console.log('\nÜrünler:', JSON.stringify(products.data, null, 2));

  // Dashboard istatistikleri
  const stats = await request('GET', '/dashboard/stats');
  console.log('\nİstatistikler:', JSON.stringify(stats.data, null, 2));
}

main().catch(console.error);

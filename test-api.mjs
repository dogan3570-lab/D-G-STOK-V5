// DG STOK V5.0 API Test Script
const BASE = 'http://localhost:4000';

async function test() {
  console.log('=== DG STOK V5.0 API TEST ===\n');
  
  // 1. Health check
  try {
    const health = await (await fetch(`${BASE}/health`)).json();
    console.log('✅ Health:', JSON.stringify(health));
  } catch (e) { console.log('❌ Health:', e.message); }

  // 2. Login
  let cookie = '';
  try {
    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@dgstok.com', password: 'admin123' }),
    });
    const login = await loginRes.json();
    console.log('✅ Login:', JSON.stringify(login));
    // Get cookie
    const setCookie = loginRes.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
  } catch (e) { console.log('❌ Login:', e.message); }

  // 3. Auth/me
  try {
    const me = await (await fetch(`${BASE}/auth/me`, {
      headers: { Cookie: cookie }
    })).json();
    console.log('✅ Auth/Me:', JSON.stringify(me));
  } catch (e) { console.log('❌ Auth/Me:', e.message); }

  // 4. Dashboard stats
  try {
    const stats = await (await fetch(`${BASE}/dashboard/stats`, {
      headers: { Cookie: cookie }
    })).json();
    console.log('✅ Dashboard Stats:', JSON.stringify(stats));
  } catch (e) { console.log('❌ Dashboard Stats:', e.message); }

  // 5. Marketplaces
  try {
    const mps = await (await fetch(`${BASE}/marketplaces`, {
      headers: { Cookie: cookie }
    })).json();
    console.log('✅ Marketplaces:', JSON.stringify(mps).substring(0, 200));
  } catch (e) { console.log('❌ Marketplaces:', e.message); }

  // 6. Products
  try {
    const products = await (await fetch(`${BASE}/products`, {
      headers: { Cookie: cookie }
    })).json();
    console.log('✅ Products:', JSON.stringify(products).substring(0, 200));
  } catch (e) { console.log('❌ Products:', e.message); }

  // 7. Brands
  try {
    const brands = await (await fetch(`${BASE}/brands`, {
      headers: { Cookie: cookie }
    })).json();
    console.log('✅ Brands:', JSON.stringify(brands).substring(0, 200));
  } catch (e) { console.log('❌ Brands:', e.message); }

  // 8. Categories
  try {
    const cats = await (await fetch(`${BASE}/categories`, {
      headers: { Cookie: cookie }
    })).json();
    console.log('✅ Categories:', JSON.stringify(cats).substring(0, 200));
  } catch (e) { console.log('❌ Categories:', e.message); }

  // 9. Variants
  try {
    const vars = await (await fetch(`${BASE}/variants`, {
      headers: { Cookie: cookie }
    })).json();
    console.log('✅ Variants:', JSON.stringify(vars).substring(0, 200));
  } catch (e) { console.log('❌ Variants:', e.message); }

  // 10. Orders
  try {
    const orders = await (await fetch(`${BASE}/orders`, {
      headers: { Cookie: cookie }
    })).json();
    console.log('✅ Orders:', JSON.stringify(orders).substring(0, 200));
  } catch (e) { console.log('❌ Orders:', e.message); }

  // 11. Settings
  try {
    const settings = await (await fetch(`${BASE}/settings`, {
      headers: { Cookie: cookie }
    })).json();
    console.log('✅ Settings:', JSON.stringify(settings).substring(0, 200));
  } catch (e) { console.log('❌ Settings:', e.message); }

  // 12. Audit Logs
  try {
    const logs = await (await fetch(`${BASE}/audit-logs`, {
      headers: { Cookie: cookie }
    })).json();
    console.log('✅ Audit Logs:', JSON.stringify(logs).substring(0, 200));
  } catch (e) { console.log('❌ Audit Logs:', e.message); }

  // 13. Templates
  try {
    const templates = await (await fetch(`${BASE}/templates`, {
      headers: { Cookie: cookie }
    })).json();
    console.log('✅ Templates:', JSON.stringify(templates).substring(0, 200));
  } catch (e) { console.log('❌ Templates:', e.message); }

  // 14. Shipments
  try {
    const shipments = await (await fetch(`${BASE}/shipments`, {
      headers: { Cookie: cookie }
    })).json();
    console.log('✅ Shipments:', JSON.stringify(shipments).substring(0, 200));
  } catch (e) { console.log('❌ Shipments:', e.message); }

  // 15. Notifications
  try {
    const notifs = await (await fetch(`${BASE}/notifications`, {
      headers: { Cookie: cookie }
    })).json();
    console.log('✅ Notifications:', JSON.stringify(notifs).substring(0, 200));
  } catch (e) { console.log('❌ Notifications:', e.message); }

  // 16. Finance
  try {
    const finance = await (await fetch(`${BASE}/finance`, {
      headers: { Cookie: cookie }
    })).json();
    console.log('✅ Finance:', JSON.stringify(finance).substring(0, 200));
  } catch (e) { console.log('❌ Finance:', e.message); }

  // 17. Messages
  try {
    const msgs = await (await fetch(`${BASE}/messages`, {
      headers: { Cookie: cookie }
    })).json();
    console.log('✅ Messages:', JSON.stringify(msgs).substring(0, 200));
  } catch (e) { console.log('❌ Messages:', e.message); }

  // 18. Users (admin only)
  try {
    const users = await (await fetch(`${BASE}/users`, {
      headers: { Cookie: cookie }
    })).json();
    console.log('✅ Users:', JSON.stringify(users).substring(0, 200));
  } catch (e) { console.log('❌ Users:', e.message); }

  // 19. XML Sources
  try {
    const xml = await (await fetch(`${BASE}/xml-sources`, {
      headers: { Cookie: cookie }
    })).json();
    console.log('✅ XML Sources:', JSON.stringify(xml).substring(0, 200));
  } catch (e) { console.log('❌ XML Sources:', e.message); }

  // 20. Dashboard Summary
  try {
    const summary = await (await fetch(`${BASE}/dashboard/summary`, {
      headers: { Cookie: cookie }
    })).json();
    console.log('✅ Dashboard Summary:', JSON.stringify(summary).substring(0, 200));
  } catch (e) { console.log('❌ Dashboard Summary:', e.message); }

  // 21. Change password test
  try {
    const pwd = await (await fetch(`${BASE}/admin/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ oldPassword: 'admin123', newPassword: 'admin123' }),
    })).json();
    console.log('✅ Change Password:', JSON.stringify(pwd));
  } catch (e) { console.log('❌ Change Password:', e.message); }

  console.log('\n=== TEST COMPLETED ===');
}

test();

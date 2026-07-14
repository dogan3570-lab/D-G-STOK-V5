/**
 * DG STOK V5.0 - E2E API Testleri
 * 
 * Kapsanan testler:
 * - Health check
 * - Authentication (login, auth/me)
 * - CRUD işlemleri (products, categories, brands, marketplaces)
 * - XML import
 * - Dashboard
 * - Raporlar
 * - WebSocket bağlantısı
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = process.env.API_URL || 'http://localhost:4000';
let authToken: string;
let testProductId: string;
let testCategoryId: string;
let testBrandId: string;
let testMarketplaceId: string;
let testXmlSourceId: string;

// Test kullanıcısı
const TEST_USER = {
  email: 'test@dgstok.com',
  password: 'test123456',
};

async function api(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (authToken) {
    headers['Cookie'] = `token=${authToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return { status: response.status, data, headers: response.headers };
}

describe('DG STOK V5.0 E2E Tests', () => {
  // ==================== HEALTH CHECK ====================
  describe('Health Check', () => {
    it('GET /health should return ok', async () => {
      const { status, data } = await api('/health');
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.service).toBe('dg-stok-integrator-server');
    });

    it('GET /api-status should return ok', async () => {
      const { status, data } = await api('/api-status');
      expect(status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.time).toBeDefined();
    });
  });

  // ==================== AUTHENTICATION ====================
  describe('Authentication', () => {
    it('POST /auth/login should fail with wrong credentials', async () => {
      const { status, data } = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'wrong@email.com', password: 'wrong' }),
      });
      expect(status).toBe(401);
      expect(data.ok).toBe(false);
    });

    it('POST /auth/login should succeed with valid credentials', async () => {
      const { status, data, headers } = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify(TEST_USER),
      });
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(TEST_USER.email);

      // Extract token from cookie
      const setCookie = headers.get('set-cookie');
      if (setCookie) {
        const match = setCookie.match(/token=([^;]+)/);
        if (match) authToken = match[1];
      }
      expect(authToken).toBeDefined();
    });

    it('GET /auth/me should return current user', async () => {
      const { status, data } = await api('/auth/me');
      expect(status).toBe(200);
      expect(data.email).toBe(TEST_USER.email);
    });

    it('GET /auth/me should fail without token', async () => {
      const oldToken = authToken;
      authToken = '';
      const { status } = await api('/auth/me');
      expect(status).toBe(401);
      authToken = oldToken;
    });
  });

  // ==================== PRODUCTS ====================
  describe('Products CRUD', () => {
    const testProduct = {
      xmlKey: `test-product-${Date.now()}`,
      title: 'Test Ürünü',
      sku: `SKU-${Date.now()}`,
      barcode: `BARCODE-${Date.now()}`,
      stock: 100,
      minStock: 10,
    };

    it('GET /products should return paginated list', async () => {
      const { status, data } = await api('/products?page=1&limit=10');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBe(1);
    });

    it('POST /products should create a new product', async () => {
      const { status, data } = await api('/products', {
        method: 'POST',
        body: JSON.stringify(testProduct),
      });
      expect(status).toBe(201);
      expect(data.ok).toBe(true);
      expect(data.item).toBeDefined();
      expect(data.item.xmlKey).toBe(testProduct.xmlKey);
      testProductId = data.item.id;
    });

    it('GET /products/:id should return product details', async () => {
      const { status, data } = await api(`/products/${testProductId}`);
      expect(status).toBe(200);
      expect(data.id).toBe(testProductId);
      expect(data.title).toBe(testProduct.title);
    });

    it('PUT /products/:id should update product', async () => {
      const { status, data } = await api(`/products/${testProductId}`, {
        method: 'PUT',
        body: JSON.stringify({ title: 'Güncellenmiş Ürün', stock: 200 }),
      });
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.item.title).toBe('Güncellenmiş Ürün');
      expect(data.item.stock).toBe(200);
    });

    it('GET /products should support search', async () => {
      const { status, data } = await api('/products?search=Güncellenmiş');
      expect(status).toBe(200);
      expect(data.items.length).toBeGreaterThan(0);
    });

    it('GET /products should support low stock filter', async () => {
      const { status, data } = await api('/products?lowStock=true');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
    });

    it('DELETE /products/:id should delete product', async () => {
      const { status, data } = await api(`/products/${testProductId}`, {
        method: 'DELETE',
      });
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });

  // ==================== CATEGORIES ====================
  describe('Categories CRUD', () => {
    const testCategory = {
      name: `Test Kategori ${Date.now()}`,
    };

    it('GET /categories should return list', async () => {
      const { status, data } = await api('/categories');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
      expect(Array.isArray(data.items)).toBe(true);
    });

    it('POST /categories should create category', async () => {
      const { status, data } = await api('/categories', {
        method: 'POST',
        body: JSON.stringify(testCategory),
      });
      expect(status).toBe(201);
      expect(data.name).toBe(testCategory.name);
      testCategoryId = data.id;
    });

    it('PUT /categories/:id should update category', async () => {
      const { status, data } = await api(`/categories/${testCategoryId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Güncellenmiş Kategori' }),
      });
      expect(status).toBe(200);
      expect(data.name).toBe('Güncellenmiş Kategori');
    });

    it('DELETE /categories/:id should delete category', async () => {
      const { status } = await api(`/categories/${testCategoryId}`, {
        method: 'DELETE',
      });
      expect(status).toBe(204);
    });
  });

  // ==================== BRANDS ====================
  describe('Brands CRUD', () => {
    const testBrand = {
      name: `Test Marka ${Date.now()}`,
    };

    it('GET /brands should return list', async () => {
      const { status, data } = await api('/brands');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
    });

    it('POST /brands should create brand', async () => {
      const { status, data } = await api('/brands', {
        method: 'POST',
        body: JSON.stringify(testBrand),
      });
      expect(status).toBe(201);
      expect(data.item.name).toBe(testBrand.name);
      testBrandId = data.item.id;
    });

    it('DELETE /brands/:id should delete brand', async () => {
      const { status, data } = await api(`/brands/${testBrandId}`, {
        method: 'DELETE',
      });
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });

  // ==================== MARKETPLACES ====================
  describe('Marketplaces CRUD', () => {
    const testMarketplace = {
      key: `test-mp-${Date.now()}`,
      name: 'Test Pazaryeri',
    };

    it('GET /marketplaces should return list', async () => {
      const { status, data } = await api('/marketplaces');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
    });

    it('POST /marketplaces should create marketplace', async () => {
      const { status, data } = await api('/marketplaces', {
        method: 'POST',
        body: JSON.stringify(testMarketplace),
      });
      expect(status).toBe(201);
      expect(data.ok).toBe(true);
      expect(data.item.name).toBe(testMarketplace.name);
      testMarketplaceId = data.item.id;
    });

    it('PUT /marketplaces/:id should update marketplace', async () => {
      const { status, data } = await api(`/marketplaces/${testMarketplaceId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Güncellenmiş Pazaryeri' }),
      });
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.item.name).toBe('Güncellenmiş Pazaryeri');
    });

    it('DELETE /marketplaces/:id should delete marketplace', async () => {
      const { status, data } = await api(`/marketplaces/${testMarketplaceId}`, {
        method: 'DELETE',
      });
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });

  // ==================== DASHBOARD ====================
  describe('Dashboard', () => {
    it('GET /dashboard/summary should return marketplace summary', async () => {
      const { status, data } = await api('/dashboard/summary');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
      expect(Array.isArray(data.items)).toBe(true);
    });

    it('GET /dashboard/stats should return system stats', async () => {
      const { status, data } = await api('/dashboard/stats');
      expect(status).toBe(200);
      expect(data.totalProducts).toBeDefined();
      expect(data.totalOrders).toBeDefined();
      expect(data.totalMarketplaces).toBeDefined();
    });
  });

  // ==================== REPORTS ====================
  describe('Reports', () => {
    it('GET /reports should return all reports', async () => {
      const { status, data } = await api('/reports');
      expect(status).toBe(200);
      expect(data.overview).toBeDefined();
      expect(data.overview.totalProducts).toBeDefined();
      expect(data.orderStatusDistribution).toBeDefined();
      expect(data.productStatusDistribution).toBeDefined();
    });

    it('GET /reports/finance should return finance report', async () => {
      const { status, data } = await api('/reports/finance');
      expect(status).toBe(200);
      expect(data.records).toBeDefined();
      expect(data.totals).toBeDefined();
    });

    it('GET /reports/products should return product report', async () => {
      const { status, data } = await api('/reports/products');
      expect(status).toBe(200);
      expect(data.totalProducts).toBeDefined();
      expect(data.products).toBeDefined();
    });

    it('GET /reports/orders should return order report', async () => {
      const { status, data } = await api('/reports/orders');
      expect(status).toBe(200);
      expect(data.totalOrders).toBeDefined();
      expect(data.totalRevenue).toBeDefined();
    });
  });

  // ==================== SETTINGS ====================
  describe('Settings', () => {
    it('GET /settings should return settings', async () => {
      const { status, data } = await api('/settings');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
    });

    it('PUT /settings should update settings', async () => {
      const { status, data } = await api('/settings', {
        method: 'PUT',
        body: JSON.stringify({ testKey: 'testValue' }),
      });
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });

  // ==================== NOTIFICATIONS ====================
  describe('Notifications', () => {
    let notificationId: string;

    it('GET /notifications should return list', async () => {
      const { status, data } = await api('/notifications');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
      expect(data.unread).toBeDefined();
    });

    it('POST /notifications should create notification', async () => {
      const { status, data } = await api('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          type: 'info',
          title: 'Test Bildirimi',
          message: 'Bu bir test bildirimidir',
        }),
      });
      expect(status).toBe(201);
      expect(data.item).toBeDefined();
      notificationId = data.item.id;
    });

    it('POST /notifications/:id/read should mark as read', async () => {
      const { status, data } = await api(`/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });

  // ==================== AUDIT LOGS ====================
  describe('Audit Logs', () => {
    it('GET /audit-logs should return logs', async () => {
      const { status, data } = await api('/audit-logs');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
      expect(data.pagination).toBeDefined();
    });
  });

  // ==================== USERS (Admin only) ====================
  describe('Users (Admin)', () => {
    it('GET /users should return user list', async () => {
      const { status, data } = await api('/users');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
      expect(Array.isArray(data.items)).toBe(true);
    });
  });

  // ==================== TEMPLATES ====================
  describe('Templates', () => {
    let templateId: string;

    it('GET /templates should return list', async () => {
      const { status, data } = await api('/templates');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
    });

    it('POST /templates should create template', async () => {
      const { status, data } = await api('/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Şablon',
          titleFormat: '{title}',
        }),
      });
      expect(status).toBe(201);
      expect(data.item).toBeDefined();
      templateId = data.item.id;
    });

    it('DELETE /templates/:id should delete template', async () => {
      const { status, data } = await api(`/templates/${templateId}`, {
        method: 'DELETE',
      });
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });

  // ==================== SHIPMENTS ====================
  describe('Shipments', () => {
    it('GET /shipments should return list', async () => {
      const { status, data } = await api('/shipments');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
    });
  });

  // ==================== MESSAGES ====================
  describe('Messages', () => {
    it('GET /messages should return list', async () => {
      const { status, data } = await api('/messages');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
    });
  });

  // ==================== FINANCE ====================
  describe('Finance', () => {
    it('GET /finance should return records', async () => {
      const { status, data } = await api('/finance');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
      expect(data.summary).toBeDefined();
    });
  });

  // ==================== ORDERS ====================
  describe('Orders', () => {
    it('GET /orders should return list', async () => {
      const { status, data } = await api('/orders');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
      expect(data.pagination).toBeDefined();
    });
  });

  // ==================== VARIANTS ====================
  describe('Variants', () => {
    it('GET /variants should return list', async () => {
      const { status, data } = await api('/variants');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
      expect(data.pagination).toBeDefined();
    });

    it('GET /variants/types should return types', async () => {
      const { status, data } = await api('/variants/types');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
    });
  });

  // ==================== AUTOMATION ====================
  describe('Automation', () => {
    let ruleId: string;

    it('GET /automation should return rules', async () => {
      const { status, data } = await api('/automation');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
    });

    it('POST /automation should create rule', async () => {
      const { status, data } = await api('/automation', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Kuralı',
          type: 'xml_sync',
          triggerType: 'schedule',
          actionType: 'sync_xml',
          schedule: '*/30 * * * *',
        }),
      });
      expect(status).toBe(201);
      expect(data.ok).toBe(true);
      expect(data.item).toBeDefined();
      ruleId = data.item.id;
    });

    it('POST /automation/:id/toggle should toggle rule', async () => {
      const { status, data } = await api(`/automation/${ruleId}/toggle`, {
        method: 'POST',
      });
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
    });

    it('DELETE /automation/:id should delete rule', async () => {
      const { status, data } = await api(`/automation/${ruleId}`, {
        method: 'DELETE',
      });
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });

  // ==================== XML SOURCES ====================
  describe('XML Sources', () => {
    it('GET /xml-sources should return list', async () => {
      const { status, data } = await api('/xml-sources');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
    });

    it('POST /xml-sources should create source', async () => {
      const { status, data } = await api('/xml-sources', {
        method: 'POST',
        body: JSON.stringify({
          name: `Test XML Kaynağı ${Date.now()}`,
          sourceType: 'MANUAL',
          url: 'https://example.com/test.xml',
        }),
      });
      expect(status).toBe(201);
      expect(data.name).toBeDefined();
      testXmlSourceId = data.id;
    });

    it('GET /xml-sources/:id should return source details', async () => {
      const { status, data } = await api(`/xml-sources/${testXmlSourceId}`);
      expect(status).toBe(200);
      expect(data.id).toBe(testXmlSourceId);
    });

    it('DELETE /xml-sources/:id should delete source', async () => {
      const { status } = await api(`/xml-sources/${testXmlSourceId}`, {
        method: 'DELETE',
      });
      expect(status).toBe(204);
    });
  });

  // ==================== WEBHOOK / SSE ====================
  describe('SSE/WebSocket', () => {
    it('GET /sse should establish SSE connection', async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`${BASE_URL}/sse`, {
          signal: controller.signal,
          headers: authToken ? { Cookie: `token=${authToken}` } : {},
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('text/event-stream');
      } catch (error: any) {
        // Timeout is expected for SSE
        expect(error.name).toBe('AbortError');
      } finally {
        clearTimeout(timeout);
      }
    });
  });

  // ==================== DEBUG ENDPOINTS ====================
  describe('Debug Endpoints', () => {
    it('POST /debug/seed-admin should seed admin', async () => {
      const { status, data } = await api('/debug/seed-admin', {
        method: 'POST',
      });
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
    });

    it('POST /debug/seed-marketplaces should seed marketplaces', async () => {
      const { status, data } = await api('/debug/seed-marketplaces', {
        method: 'POST',
      });
      expect(status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });
});

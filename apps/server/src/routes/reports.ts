import { Router } from 'express';
import { prisma } from '../db/prisma.ts';

const router = Router();

// GET /reports - Get all reports data
router.get('/', async (_req, res) => {
  try {
    // Temel istatistikler
    const [
      totalProducts,
      totalOrders,
      totalMarketplaces,
      totalXmlSources,
      activeXmlSources,
      lowStockProducts,
      errorProducts,
      todayOrders,
      totalUsers,
      totalCategories,
      totalBrands,
      totalVariants,
      totalMessages,
      totalNotifications,
      totalFinanceRecords,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.order.count(),
      prisma.marketplace.count(),
      prisma.xmlSource.count(),
      prisma.xmlSource.count({ where: { active: true } }),
      prisma.product.count({ where: { stock: { lte: 0 } } }),
      prisma.product.count({ where: { status: 'ERROR' } }),
      prisma.order.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
      prisma.user.count(),
      prisma.category.count(),
      prisma.brand.count(),
      prisma.variant.count(),
      prisma.message.count(),
      prisma.notification.count(),
      prisma.financeRecord.count(),
    ]);

    // Sipariş durum dağılımı
    const orderStatusDistribution = await prisma.order.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    // Ürün durum dağılımı
    const productStatusDistribution = await prisma.product.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    // Pazaryeri bazında ürün dağılımı
    const marketplaceProductCounts = await prisma.productMarketplaceState.groupBy({
      by: ['marketplaceId', 'status'],
      _count: { marketplaceId: true },
    });

    // Pazaryeri isimlerini al
    const marketplaces = await prisma.marketplace.findMany({
      select: { id: true, name: true, key: true },
    });
    const marketplaceMap = new Map(marketplaces.map(m => [m.id, m]));

    const marketplaceDistribution = marketplaceProductCounts.map(item => ({
      marketplaceId: item.marketplaceId,
      marketplaceName: marketplaceMap.get(item.marketplaceId)?.name || 'Bilinmeyen',
      marketplaceKey: marketplaceMap.get(item.marketplaceId)?.key || 'unknown',
      status: item.status,
      count: item._count.marketplaceId,
    }));

    // Finans özeti
    const financeSummary = await prisma.financeRecord.groupBy({
      by: ['type'],
      _sum: {
        amount: true,
        profit: true,
        commission: true,
        vat: true,
      },
      _count: { type: true },
    });

    // Aylık sipariş istatistikleri (son 12 ay)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: twelveMonthsAgo },
      },
      select: {
        createdAt: true,
        total: true,
      },
    });

    // Aylık gruplama
    const monthlyStats: Record<string, { orders: number; total: number }> = {};
    for (const order of monthlyOrders) {
      const monthKey = order.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { orders: 0, total: 0 };
      }
      monthlyStats[monthKey].orders++;
      monthlyStats[monthKey].total += order.total;
    }

    const monthlyOrderStats = Object.entries(monthlyStats)
      .map(([month, stats]) => ({
        month,
        orders: stats.orders,
        total: Math.round(stats.total * 100) / 100,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // XML içe aktarma istatistikleri
    const importRuns = await prisma.xmlImportRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 100,
    });

    const totalImportStats = importRuns.reduce(
      (acc, run) => ({
        totalRuns: acc.totalRuns + 1,
        totalNew: acc.totalNew + run.newProducts,
        totalUpdated: acc.totalUpdated + run.updatedProducts,
        totalFailed: acc.totalFailed + run.failedProducts,
        totalSkipped: acc.totalSkipped + run.skippedProducts,
      }),
      { totalRuns: 0, totalNew: 0, totalUpdated: 0, totalFailed: 0, totalSkipped: 0 }
    );

    // Stok durumu
    const stockStats = await prisma.product.groupBy({
      by: ['stock'],
      _count: { stock: true },
    });

    const stockDistribution = {
      outOfStock: 0,
      lowStock: 0,
      sufficient: 0,
      overStock: 0,
    };

    for (const item of stockStats) {
      if (item.stock <= 0) stockDistribution.outOfStock += item._count.stock;
      else if (item.stock <= 5) stockDistribution.lowStock += item._count.stock;
      else if (item.stock <= 50) stockDistribution.sufficient += item._count.stock;
      else stockDistribution.overStock += item._count.stock;
    }

    // En çok satan ürünler (siparişlerde en çok geçen)
    const ordersWithItems = await prisma.order.findMany({
      where: {
        items: { not: null },
      },
      select: { items: true },
      take: 500,
      orderBy: { createdAt: 'desc' },
    });

    // Kategori bazında ürün dağılımı
    const categoryProductCounts = await prisma.product.groupBy({
      by: ['categoryId'],
      _count: { categoryId: true },
    });

    const categories = await prisma.category.findMany({
      select: { id: true, name: true },
    });
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    const categoryDistribution = categoryProductCounts.map(item => ({
      categoryId: item.categoryId,
      categoryName: categoryMap.get(item.categoryId || '')?.name || 'Kategorisiz',
      count: item._count.categoryId,
    }));

    res.json({
      overview: {
        totalProducts,
        totalOrders,
        totalMarketplaces,
        totalXmlSources,
        activeXmlSources,
        lowStockProducts,
        errorProducts,
        todayOrders,
        totalUsers,
        totalCategories,
        totalBrands,
        totalVariants,
        totalMessages,
        totalNotifications,
        totalFinanceRecords,
      },
      orderStatusDistribution: orderStatusDistribution.map(item => ({
        status: item.status,
        count: item._count.status,
      })),
      productStatusDistribution: productStatusDistribution.map(item => ({
        status: item.status,
        count: item._count.status,
      })),
      marketplaceDistribution,
      financeSummary: financeSummary.map(item => ({
        type: item.type,
        totalAmount: item._sum.amount || 0,
        totalProfit: item._sum.profit || 0,
        totalCommission: item._sum.commission || 0,
        totalVat: item._sum.vat || 0,
        count: item._count.type,
      })),
      monthlyOrderStats,
      importStats: totalImportStats,
      stockDistribution,
      categoryDistribution,
    });
  } catch (error) {
    console.error('[reports] GET error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Rapor verileri alınamadı' } });
  }
});

// GET /reports/finance - Detaylı finans raporu
router.get('/finance', async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : new Date();

    const where = {
      date: { gte: startDate, lte: endDate },
    };

    const records = await prisma.financeRecord.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const summary = await prisma.financeRecord.groupBy({
      by: ['type'],
      where,
      _sum: {
        amount: true,
        profit: true,
        commission: true,
        vat: true,
      },
    });

    const totalIncome = records
      .filter(r => ['sale'].includes(r.type))
      .reduce((sum, r) => sum + r.amount, 0);

    const totalExpense = records
      .filter(r => ['expense', 'commission', 'cargo'].includes(r.type))
      .reduce((sum, r) => sum + r.amount, 0);

    res.json({
      records,
      summary: summary.map(item => ({
        type: item.type,
        totalAmount: item._sum.amount || 0,
        totalProfit: item._sum.profit || 0,
        totalCommission: item._sum.commission || 0,
        totalVat: item._sum.vat || 0,
      })),
      totals: {
        income: totalIncome,
        expense: totalExpense,
        netProfit: totalIncome - totalExpense,
      },
      dateRange: {
        start: startDate,
        end: endDate,
      },
    });
  } catch (error) {
    console.error('[reports] FINANCE error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Finans raporu alınamadı' } });
  }
});

// GET /reports/products - Detaylı ürün raporu
router.get('/products', async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const categoryId = req.query.categoryId ? String(req.query.categoryId) : null;
    const brandId = req.query.brandId ? String(req.query.brandId) : null;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        marketplaceStates: {
          include: { marketplace: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Pazaryeri bazında ürün durumu
    const marketplaceStats = await prisma.productMarketplaceState.groupBy({
      by: ['marketplaceId', 'status'],
      _count: true,
    });

    const marketplaces = await prisma.marketplace.findMany({
      select: { id: true, name: true },
    });
    const mpMap = new Map(marketplaces.map(m => [m.id, m.name]));

    const marketplaceReport = marketplaceStats.map(item => ({
      marketplaceName: mpMap.get(item.marketplaceId) || 'Bilinmeyen',
      status: item.status,
      count: item._count,
    }));

    res.json({
      totalProducts: products.length,
      products,
      marketplaceReport,
    });
  } catch (error) {
    console.error('[reports] PRODUCTS error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Ürün raporu alınamadı' } });
  }
});

// GET /reports/orders - Detaylı sipariş raporu
router.get('/orders', async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const channel = req.query.channel ? String(req.query.channel) : null;
    const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : new Date();

    const where: Record<string, unknown> = {
      createdAt: { gte: startDate, lte: endDate },
    };
    if (status) where.status = status;
    if (channel) where.channel = channel;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const totalCommission = orders.reduce((sum, o) => sum + (o.commission || 0), 0);
    const totalCargo = orders.reduce((sum, o) => sum + (o.cargoPrice || 0), 0);

    // Kanal bazında dağılım
    const channelDistribution = await prisma.order.groupBy({
      by: ['channel'],
      where,
      _count: { channel: true },
      _sum: { total: true },
    });

    res.json({
      totalOrders: orders.length,
      totalRevenue,
      totalCommission,
      totalCargo,
      netRevenue: totalRevenue - totalCommission - totalCargo,
      orders,
      channelDistribution: channelDistribution.map(item => ({
        channel: item.channel,
        count: item._count.channel,
        total: item._sum.total || 0,
      })),
      dateRange: { start: startDate, end: endDate },
    });
  } catch (error) {
    console.error('[reports] ORDERS error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'Sipariş raporu alınamadı' } });
  }
});

// GET /reports/xml - XML içe aktarma raporu
router.get('/xml', async (_req, res) => {
  try {
    const sources = await prisma.xmlSource.findMany({
      include: {
        importRuns: {
          orderBy: { startedAt: 'desc' },
          take: 50,
        },
        _count: {
          select: { products: true },
        },
      },
    });

    const report = sources.map(source => {
      const runs = source.importRuns;
      const totalRuns = runs.length;
      const successfulRuns = runs.filter(r => r.status === 'completed').length;
      const failedRuns = runs.filter(r => r.status === 'failed').length;
      const totalNew = runs.reduce((sum, r) => sum + r.newProducts, 0);
      const totalUpdated = runs.reduce((sum, r) => sum + r.updatedProducts, 0);
      const totalFailed = runs.reduce((sum, r) => sum + r.failedProducts, 0);

      return {
        id: source.id,
        name: source.name,
        company: source.company,
        active: source.active,
        connectionStatus: source.connectionStatus,
        productCount: source._count.products,
        lastRunAt: source.lastRunAt,
        lastSuccessAt: source.lastSuccessAt,
        lastError: source.lastError,
        importStats: {
          totalRuns,
          successfulRuns,
          failedRuns,
          totalNew,
          totalUpdated,
          totalFailed,
        },
      };
    });

    res.json({ sources: report });
  } catch (error) {
    console.error('[reports] XML error:', error);
    res.status(500).json({ error: { code: 'DB_ERROR', message: 'XML raporu alınamadı' } });
  }
});

export default router;

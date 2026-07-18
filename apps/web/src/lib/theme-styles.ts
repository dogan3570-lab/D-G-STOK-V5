import { useThemeConfig, WorkMode } from './theme-context';

export function useThemeStyles() {
  const { theme, density, workMode, chartSize } = useThemeConfig();
  const isModern = theme === 'modern';
  const isProfessional = theme === 'professional';
  const isCompact = density === 'compact';
  const isWide = density === 'wide';
  const kpiWidth = isWide ? 'w-[260px]' : isCompact ? 'w-[180px]' : 'w-[220px]';
  const kpiHeight = isWide ? 'h-32' : isCompact ? 'h-24' : 'h-28';
  const tableRowHeight = isCompact ? 'py-1.5' : 'py-3';
  const cardPadding = isCompact ? 'p-3' : 'p-5';
  const chartHeight = chartSize === 'large' ? 'min-h-[550px]' : chartSize === 'small' ? 'min-h-[220px]' : 'min-h-[350px]';
  const kpiValueSize = isCompact ? 'text-xl' : 'text-[28px]';
  const titleSize = isModern ? 'text-2xl' : 'text-lg';
  return { isModern, isProfessional, isCompact, isWide, workMode, kpiWidth, kpiHeight, tableRowHeight, cardPadding, chartHeight, kpiValueSize, titleSize, isYonetici: workMode === 'yonetici', isOperasyon: workMode === 'operasyon', isMuhasebe: workMode === 'muhasebe' };
}

export function getMenuItemsByWorkMode(_workMode: WorkMode) {
  return [
    { key: 'kontrol', label: 'Kontrol Paneli', icon: '📊' },
    { key: 'xml', label: 'XML Kaynakları', icon: '🔗' },
    { key: 'urunhavuzu', label: 'Ürün Havuzu', icon: '📦' },
    { key: 'kategori', label: 'Kategori Yönetimi', icon: '🗂️' },
    { key: 'marka', label: 'Marka Yönetimi', icon: '🏷️' },
    { key: 'sablon', label: 'Listeleme Şablonları', icon: '📋' },
    { key: 'urunhazirlama', label: 'Ürün Hazırlama', icon: '⚙️' },
    { key: 'gonderimehazir', label: 'Gönderime Hazır', icon: '✅' },
    { key: 'pazaryeri', label: 'Pazaryeri Yönetimi', icon: '🛒' },
    { key: 'entegrasyon', label: 'Entegrasyon Merkezi', icon: '🚚' },
    { key: 'siparis', label: 'Siparişler', icon: '📑' },
    {
      key: 'rapor', label: 'Raporlar', icon: '📊',
      children: [
        { key: 'r_satis', label: 'Satış', icon: '📊' },
        { key: 'r_finans', label: 'Finans', icon: '💰' },
        { key: 'r_siparis', label: 'Sipariş', icon: '📦' },
        { key: 'r_xml', label: 'XML', icon: '🔗' },
        { key: 'r_entegrasyon', label: 'Entegrasyon', icon: '🚚' },
        { key: 'r_karlilik', label: 'Karlılık', icon: '📈' },
        { key: 'r_stok', label: 'Stok', icon: '📋' },
        { key: 'r_iade', label: 'İadeler', icon: '🔄' },
      ],
    },
    { key: 'ayar', label: 'Ayarlar', icon: '⚙️' },
  ];
}

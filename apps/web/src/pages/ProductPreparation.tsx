// ==================== URUN HAZIRLAMA V2.0 ====================
// DG STOK V5.0 - Tek ekran, 4 sekme: Kategori, Marka, Varyant, Listeleme
// StockMount esinlenmesi, minimum kullanici mudahalesi
import React, { useState } from 'react';
import CategoryMatchTab from './prep/CategoryMatchTab';
import BrandMatchTab from './prep/BrandMatchTab';
import VariantMatchTab from './prep/VariantMatchTab';
import ListingTemplateTab from './prep/ListingTemplateTab';

type PrepTab = 'kategori' | 'marka' | 'varyant' | 'listeleme';

interface TabConfig {
  key: PrepTab;
  label: string;
  icon: string;
  desc: string;
}

const TABS: TabConfig[] = [
  { key: 'kategori', label: 'Kategori', icon: '🗂️', desc: 'XML kategori analizi ve pazaryeri eslestirme' },
  { key: 'marka', label: 'Marka', icon: '🏷️', desc: 'XML marka yonetimi ve on ek duzenleme' },
  { key: 'varyant', label: 'Varyant', icon: '🧬', desc: 'Varyant dogrulama ve eslestirme' },
  { key: 'listeleme', label: 'Listeleme', icon: '📋', desc: 'Fiyat barem ve kural yonetimi' },
];

export default function ProductPreparation() {
  const [activeTab, setActiveTab] = useState<PrepTab>('kategori');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>⚙️</span> Ürün Hazırlama
          <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-normal">V2.0</span>
        </h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Kategori, marka, varyant ve listeleme şablonu yönetimi — Profesyonel entegratör
        </p>
      </div>

      {/* Sekmeler */}
      <div className="flex gap-1 rounded-xl border border-slate-700 bg-slate-800/50 p-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title={tab.desc}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Icerik */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/30 backdrop-blur-sm p-4">
        {activeTab === 'kategori' && <CategoryMatchTab />}
        {activeTab === 'marka' && <BrandMatchTab />}
        {activeTab === 'varyant' && <VariantMatchTab />}
        {activeTab === 'listeleme' && <ListingTemplateTab />}
      </div>
    </div>
  );
}

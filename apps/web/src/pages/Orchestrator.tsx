import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface ModuleCard {
  key: string; label: string; icon: string; desc: string; color: string;
  api: string; stats: Record<string, number | string>;
}

export default function Orchestrator() {
  const [modules, setModules] = useState<ModuleCard[]>([
    { key: 'brands', label: 'Brand Intelligence V6', icon: '🏷️', desc: 'Marka yönetimi, AI eşleştirme, ön ek sistemi', color: 'blue', api: '/brands/stats', stats: {} },
    { key: 'policy', label: 'Brand Policy Engine', icon: '📋', desc: '7 marka politikası, XML kaynağı bazlı kurallar', color: 'purple', api: '/brand-policies', stats: {} },
    { key: 'transform', label: 'Transformation V7', icon: '🔄', desc: 'Marka dönüşümü, başlık temizleme, validasyon', color: 'cyan', api: '/transform/logs', stats: {} },
    { key: 'title', label: 'Title Intelligence V8', icon: '📝', desc: 'Şablonlu başlık oluşturma, 12 değişken', color: 'teal', api: '/title/templates', stats: {} },
    { key: 'workflow', label: 'Workflow V1', icon: '⚡', desc: 'Ürün yaşam döngüsü, hazırlık skoru', color: 'green', api: '/workflow/stats', stats: {} },
    { key: 'ai', label: 'AI Decision V1', icon: '🤖', desc: 'AI öğrenme, güven puanı, otomatik karar', color: 'violet', api: '/ai/stats', stats: {} },
    { key: 'plm', label: 'PLM V1', icon: '📊', desc: '24 aşamalı ürün yaşam döngüsü, sağlık skoru', color: 'orange', api: '/plm/health', stats: {} },
    { key: 'rules', label: 'Rule Engine V1', icon: '🔧', desc: '11 operatör, görsel kural oluşturma', color: 'red', api: '/rules', stats: {} },
  ]);

  useEffect(() => {
    modules.forEach((mod, i) => {
      apiFetch<any>(mod.api).then(res => {
        if (res.ok && res.data) {
          const stats = { ...mod.stats };
          if (mod.key === 'workflow' && res.data.total) { stats.total = res.data.total; stats.avgReadiness = `${res.data.avgReadiness || 0}%`; }
          if (mod.key === 'brands' && res.data.totalSystemBrands) { stats.marka = res.data.totalSystemBrands; stats.urun = res.data.matchedProducts; }
          if (mod.key === 'ai' && res.data.totalKnowledge) { stats.bilgi = res.data.totalKnowledge; stats.karar = res.data.totalDecisions; }
          if (mod.key === 'plm' && res.data.average) { stats.ortalama = `${res.data.average}%`; stats.toplam = res.data.total; }
          if (mod.key === 'rules' && res.data.items) stats.kural = res.data.items.length;
          if (mod.key === 'title' && res.data.items) stats.sablon = res.data.items.length;
          if (mod.key === 'policy' && res.data.items) stats.politika = res.data.items.length;
          if (mod.key === 'transform' && res.data.items) stats.islem = res.data.items.length;
          setModules(prev => { const n = [...prev]; n[i] = { ...n[i], stats }; return n; });
        }
      }).catch(() => {});
    });
  }, []);

  const colorClasses: Record<string, string> = {
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    purple: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
    cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
    teal: 'border-teal-500/30 bg-teal-500/10 text-teal-400',
    green: 'border-green-500/30 bg-green-500/10 text-green-400',
    violet: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
    orange: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
    red: 'border-red-500/30 bg-red-500/10 text-red-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <span>🚀</span> DG STOK V5.0 Orchestrator
            <span className="text-xs bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1 rounded-full font-normal">8 Modül Aktif</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">Tüm modüller tek ekranda · IQ300 Mission</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modules.map(mod => (
          <div key={mod.key} className={`rounded-xl border p-4 backdrop-blur-sm ${colorClasses[mod.color] || colorClasses.blue} hover:scale-[1.02] transition-all cursor-pointer`}
            onClick={() => {
              const pageMap: Record<string, string> = { brands: 'marka', policy: 'marka', transform: 'marka', title: 'marka', workflow: 'kontrol', ai: 'marka', plm: 'kontrol', rules: 'marka' };
              window.location.hash = pageMap[mod.key] || 'kontrol';
            }}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{mod.icon}</span>
              {Object.keys(mod.stats).length > 0 && (
                <span className="text-xs font-medium bg-white/10 px-2 py-1 rounded-full">
                  {Object.values(mod.stats).slice(0, 2).join(' · ')}
                </span>
              )}
            </div>
            <h3 className="font-semibold text-sm mb-1">{mod.label}</h3>
            <p className="text-xs opacity-70">{mod.desc}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {Object.entries(mod.stats).map(([k, v]) => (
                <span key={k} className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded">{k}: {v}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* API Status */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-white mb-3">🔌 API Durumu</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
          {modules.map(mod => (
            <div key={mod.key} className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/30">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-slate-300">{mod.icon}</span>
              <code className="text-slate-400">/{mod.api.split('/')[1]}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

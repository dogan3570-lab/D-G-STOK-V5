import React, { useEffect, useState } from 'react';

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const response = await fetch('/settings', { credentials: 'include' });
      const data = await response.json();
      setSettings(data.items || {});
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      if (response.ok) {
        setMessage('✅ Ayarlar kaydedildi');
      } else {
        setMessage('❌ Hata oluştu');
      }
    } catch (error) {
      setMessage('❌ Ağ hatası');
    } finally {
      setSaving(false);
    }
  }

  const settingFields = [
    { key: 'company_name', label: 'Firma Adı', type: 'text' },
    { key: 'company_phone', label: 'Telefon', type: 'text' },
    { key: 'company_email', label: 'E-posta', type: 'email' },
    { key: 'company_address', label: 'Adres', type: 'text' },
    { key: 'default_vat', label: 'Varsayılan KDV (%)', type: 'number' },
    { key: 'default_commission', label: 'Varsayılan Komisyon (%)', type: 'number' },
    { key: 'default_currency', label: 'Para Birimi', type: 'text' },
    { key: 'cargo_company', label: 'Varsayılan Kargo Firması', type: 'text' },
  ];

  if (loading) {
    return <div className="flex items-center justify-center p-8 text-slate-400">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Sistem Ayarları</h2>
          <p className="text-sm text-slate-400">Firma bilgileri ve sistem yapılandırması</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm ${message.startsWith('✅') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {message}
        </div>
      )}

      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">FİRMA BİLGİLERİ</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {settingFields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-300 mb-1">{field.label}</label>
              <input
                type={field.type}
                value={settings[field.key] || ''}
                onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

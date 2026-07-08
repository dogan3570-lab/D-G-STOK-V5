import React, { useEffect, useState } from 'react';

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; email: string; role: string; name: string | null }>>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState('');

  useEffect(() => {
    fetchSettings();
    fetchCurrentUser();
  }, []);

  async function fetchCurrentUser() {
    try {
      const response = await fetch('/auth/me', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUserRole(data.role || null);
      }
    } catch {}
  }

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

  async function fetchUsers() {
    try {
      const response = await fetch('/users', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.items || []);
      }
    } catch {}
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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage('❌ Yeni şifreler eşleşmiyor');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordMessage('❌ Yeni şifre en az 6 karakter olmalıdır');
      return;
    }

    try {
      const response = await fetch('/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await response.json();
      if (data.ok) {
        setPasswordMessage('✅ Şifre başarıyla güncellendi');
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setShowPasswordModal(false), 1500);
      } else {
        setPasswordMessage(`❌ ${data.error?.message || 'Hata oluştu'}`);
      }
    } catch {
      setPasswordMessage('❌ Ağ hatası');
    }
  }

  async function handleUpdateUserRole(userId: string, newRole: string) {
    try {
      await fetch(`/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      });
      fetchUsers();
    } catch {}
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

      {/* Şifre Değiştirme */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">ŞİFRE DEĞİŞTİR</h3>
        <p className="text-sm text-slate-400 mb-4">Hesap şifrenizi değiştirmek için tıklayın.</p>
        <button
          onClick={() => setShowPasswordModal(true)}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 transition-colors"
        >
          🔑 Şifre Değiştir
        </button>
      </div>

      {/* Yönetici İşlemleri - Sadece ADMIN rolü için */}
      {userRole === 'ADMIN' && (
        <div className="rounded-xl border border-amber-700 bg-amber-900/20 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-amber-300">🔐 YÖNETİCİ İŞLEMLERİ</h3>
              <p className="text-sm text-amber-400/70 mt-1">Sadece admin kullanıcılar için özel işlemler</p>
            </div>
            <button
              onClick={() => { fetchUsers(); }}
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
            >
              Kullanıcıları Listele
            </button>
          </div>

          {/* Kullanıcı Yönetimi */}
          {users.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-amber-700/50">
              <table className="w-full">
                <thead className="bg-amber-900/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-amber-300">E-posta</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-amber-300">Ad</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-amber-300">Rol</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-amber-300">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-800/30">
                  {users.map((user) => (
                    <tr key={user.id} className="bg-amber-900/10 hover:bg-amber-900/20 transition-colors">
                      <td className="px-4 py-3 text-sm text-amber-200">{user.email}</td>
                      <td className="px-4 py-3 text-sm text-amber-200">{user.name || '-'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                          className="rounded border border-amber-700 bg-amber-900/50 px-2 py-1 text-sm text-amber-200 focus:border-amber-500 focus:outline-none"
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="OPERATOR">Operatör</option>
                          <option value="VIEWER">İzleyici</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleUpdateUserRole(user.id, user.role)}
                          className="rounded px-3 py-1 text-xs text-amber-400 hover:bg-amber-700/30 transition-colors"
                        >
                          Güncelle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {users.length === 0 && (
            <div className="text-sm text-amber-400/60 py-4 text-center">
              Kullanıcıları listelemek için butona tıklayın.
            </div>
          )}
        </div>
      )}

      {/* Şifre Değiştirme Modalı */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">🔑 Şifre Değiştir</h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Eski Şifre</label>
                <input
                  type="password"
                  value={passwordForm.oldPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Yeni Şifre</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Yeni Şifre (Tekrar)</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                  required
                  minLength={6}
                />
              </div>

              {passwordMessage && (
                <div className={`rounded-lg px-4 py-2.5 text-sm ${passwordMessage.startsWith('✅') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {passwordMessage}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowPasswordModal(false); setPasswordMessage(''); }}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  Şifreyi Güncelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

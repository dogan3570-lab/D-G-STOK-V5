import React, { useEffect, useState } from 'react';

interface UserItem {
  id: string; email: string; role: string;
  name: string | null; phone?: string | null;
  department?: string | null; status?: string;
  lastLogin?: string; createdAt: string;
}

const ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'PRODUCT_MANAGER', 'XML_MANAGER',
  'CATEGORY_MANAGER', 'BRAND_MANAGER', 'VARIANT_MANAGER', 'ORDER_MANAGER',
  'ACCOUNTING', 'WAREHOUSE', 'SUPPORT', 'REPORTS', 'VIEW_ONLY', 'GUEST',
];

const DEPARTMENTS = ['Yönetim', 'Operasyon', 'Muhasebe', 'Depo', 'Pazarlama', 'Müşteri Hizmetleri', 'IT', 'Destek'];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: '👑 Süper Admin', ADMIN: '🔧 Admin', OPERATOR: '⚙️ Operatör',
  PRODUCT_MANAGER: '📦 Ürün Yöneticisi', XML_MANAGER: '🔗 XML Yöneticisi',
  CATEGORY_MANAGER: '🗂️ Kategori Yöneticisi', BRAND_MANAGER: '🏷️ Marka Yöneticisi',
  VARIANT_MANAGER: '🧬 Varyant Yöneticisi', ORDER_MANAGER: '📦 Sipariş Yöneticisi',
  ACCOUNTING: '💰 Muhasebe', WAREHOUSE: '📦 Depo', SUPPORT: '🎧 Destek',
  REPORTS: '📊 Raporlama', VIEW_ONLY: '👁️ Sadece Görüntüleme', GUEST: '🚪 Misafir',
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Form
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'OPERATOR', department: '', phone: '', active: true });

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch('/users', { credentials: 'include' });
      const data = await res.json();
      setUsers(data.items || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  function openCreate() {
    setEditingUser(null);
    setForm({ name: '', email: '', password: '', role: 'OPERATOR', department: '', phone: '', active: true });
    setShowModal(true);
  }

  function openEdit(user: UserItem) {
    setEditingUser(user);
    setForm({ name: user.name || '', email: user.email, password: '', role: user.role, department: user.department || '', phone: user.phone || '', active: user.status !== 'passive' });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = editingUser ? `/users/${editingUser.id}` : '/users';
      const method = editingUser ? 'PUT' : 'POST';
      const body: any = { name: form.name, email: form.email, role: form.role, department: form.department, phone: form.phone };
      if (form.password) body.password = form.password;

      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowModal(false);
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Hata oluştu');
      }
    } catch (err) { console.error(err); }
  }

  async function handleToggleActive(user: UserItem) {
    try {
      await fetch(`/users/${user.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ role: user.role, name: user.name }),
      });
      fetchUsers();
    } catch (err) { console.error(err); }
  }

  const filteredUsers = users.filter(u =>
    (!search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())) &&
    (!roleFilter || u.role === roleFilter)
  );

  const activeCount = users.length;
  const onlineCount = 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Kullanıcı Yönetimi</h2>
          <p className="text-sm text-slate-400">Rol bazlı yetkilendirme ve kullanıcı yönetimi</p>
        </div>
        <button onClick={openCreate} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">+ Yeni Kullanıcı</button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 backdrop-blur-sm">
          <div className="text-xs text-slate-400">Toplam Kullanıcı</div>
          <div className="text-lg font-semibold text-white">{users.length}</div>
        </div>
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 backdrop-blur-sm">
          <div className="text-xs text-slate-400">Aktif</div>
          <div className="text-lg font-semibold text-green-400">{activeCount}</div>
        </div>
        <div className="rounded-xl border border-slate-500/20 bg-slate-500/10 p-3 backdrop-blur-sm">
          <div className="text-xs text-slate-400">Pasif</div>
          <div className="text-lg font-semibold text-slate-400">{users.length - activeCount}</div>
        </div>
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 backdrop-blur-sm">
          <div className="text-xs text-slate-400">Online</div>
          <div className="text-lg font-semibold text-green-400">{onlineCount}</div>
        </div>
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-3 backdrop-blur-sm">
          <div className="text-xs text-slate-400">Rol</div>
          <div className="text-lg font-semibold text-purple-400">{ROLES.length}</div>
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 backdrop-blur-sm">
          <div className="text-xs text-slate-400">Departman</div>
          <div className="text-lg font-semibold text-cyan-400">{DEPARTMENTS.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-3 backdrop-blur-sm">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Kullanıcı ara (ad, e-posta)..." className="flex-1 min-w-[200px] rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white" />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white">
          <option value="">Tüm Roller</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white">
          <option value="">Tüm Durumlar</option>
          <option value="active">Aktif</option>
          <option value="passive">Pasif</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Yükleniyor...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <div className="text-4xl mb-2">👥</div>
            <div>Kullanıcı bulunamadı</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-300">Kullanıcı</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-300">E-posta</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-300">Rol</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-300">Departman</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-300">Durum</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-300">Son Giriş</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-300">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="bg-slate-800/30 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
                          {(user.name || user.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{user.name || '-'}</div>
                          <div className="text-xs text-slate-500">{user.phone || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400">
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{user.department || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-green-500/10 text-green-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                        Aktif
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">-</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(user)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white" title="Düzenle">✏️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rol Kartları */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-white mb-3">🔐 Sistem Rolleri</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {ROLES.map(role => (
            <div key={role} className="rounded-lg bg-slate-700/30 p-3">
              <div className="text-xs text-slate-400">{ROLE_LABELS[role] || role}</div>
              <div className="text-lg font-semibold text-white mt-1">{users.filter(u => u.role === role).length}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">{editingUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Ad Soyad</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">E-posta *</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">{editingUser ? 'Yeni Şifre (boş = değişmez)' : 'Şifre *'}</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Telefon</label>
                  <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Rol *</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white">
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Departman</label>
                  <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white">
                    <option value="">Seçilmedi</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-600">İptal</button>
                <button type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  {editingUser ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

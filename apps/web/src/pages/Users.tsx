import React, { useEffect, useState } from 'react';

interface UserItem {
  id: string;
  email: string;
  role: string;
  name: string | null;
  createdAt: string;
}

export default function Users() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    try {
      const response = await fetch('/users', { credentials: 'include' });
      const data = await response.json();
      setUsers(data.items || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }

  const roleColors: Record<string, string> = {
    ADMIN: 'bg-purple-500/10 text-purple-400',
    OPERATOR: 'bg-blue-500/10 text-blue-400',
    VIEWER: 'bg-slate-500/10 text-slate-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Kullanıcılar</h2>
          <p className="text-sm text-slate-400">Sistem kullanıcıları ve yetkileri</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-slate-400">Yükleniyor...</div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400">
            <div className="text-4xl mb-2">👥</div>
            <div>Kullanıcı bulunamadı</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Ad Soyad</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">E-posta</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Rol</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Kayıt Tarihi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {users.map((user) => (
                  <tr key={user.id} className="bg-slate-800/30 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{user.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${roleColors[user.role] || 'bg-slate-500/10 text-slate-400'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{new Date(user.createdAt).toLocaleDateString('tr-TR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

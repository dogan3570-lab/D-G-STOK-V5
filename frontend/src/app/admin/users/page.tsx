'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Search, ArrowLeft, Shield, ShieldAlert, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

interface AppUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
}

const roleColors: Record<string, string> = {
  admin: 'bg-black text-white',
  editor: 'bg-blue-50 text-blue-700',
  user: 'bg-gray-50 text-gray-700',
};

const roleText: Record<string, string> = {
  admin: 'Admin',
  editor: 'Editör',
  user: 'Kullanıcı',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  inactive: 'bg-gray-50 text-gray-500',
  banned: 'bg-red-50 text-red-700',
};

const statusText: Record<string, string> = {
  active: 'Aktif',
  inactive: 'Pasif',
  banned: 'Yasaklı',
};

const roleOptions = ['user', 'editor', 'admin'];
const statusOptions = ['active', 'inactive', 'banned'];

export default function AdminUsersPage() {
  const router = useRouter();
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!isAuthenticated || currentUser?.role !== 'admin') {
      router.push('/auth/login');
      return;
    }
    loadUsers();
  }, [isAuthenticated, currentUser, page]);

  const loadUsers = async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (search) params.set('search', search);

      const data = await api.request(`/users?${params}`);
      const userList = data?.data || [];
      setUsers(userList);
      setTotalPages(Math.ceil((data?.total || 0) / 20));
    } catch (error) {
      console.error('Kullanicilar yuklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setLoading(true);
    loadUsers();
  };

  const handleRoleUpdate = async (userId: string, newRole: string) => {
    try {
      await api.request(`/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      toast.success('Kullanıcı rolü güncellendi');
      loadUsers();
    } catch (error: any) {
      toast.error('Rol güncellenemedi', { description: error.message });
    }
  };

  const handleStatusUpdate = async (userId: string, newStatus: string) => {
    try {
      await api.request(`/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success('Kullanıcı durumu güncellendi');
      loadUsers();
    } catch (error: any) {
      toast.error('Durum güncellenemedi', { description: error.message });
    }
  };

  if (!isAuthenticated || currentUser?.role !== 'admin') return null;

  return (
    <main className="min-h-screen bg-gray-50 pt-24">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="text-gray-400 hover:text-black transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-light text-gray-900">Kullanıcılar</h1>
            <p className="text-sm text-gray-500 mt-1">Kullanıcı yönetimi ve yetkilendirme</p>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="İsim veya e-posta ile ara..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 text-sm focus:outline-none focus:border-black transition-colors"
            />
          </div>
        </form>

        {/* Users Table */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-white border border-gray-100" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white border border-gray-100 p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-light text-gray-900 mb-2">Kullanıcı Bulunamadı</h2>
            <p className="text-gray-500">Henüz hiçbir kullanıcı bulunmuyor.</p>
          </div>
        ) : (
          <>
            <div className="bg-white border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left p-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Kullanıcı</th>
                    <th className="text-left p-4 text-xs text-gray-500 font-medium uppercase tracking-wider hidden md:table-cell">E-posta</th>
                    <th className="text-center p-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Rol</th>
                    <th className="text-center p-4 text-xs text-gray-500 font-medium uppercase tracking-wider hidden sm:table-cell">Durum</th>
                    <th className="text-left p-4 text-xs text-gray-500 font-medium uppercase tracking-wider hidden lg:table-cell">Son Giriş</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {u.firstName} {u.lastName}
                            {u.id === currentUser?.id && (
                              <span className="ml-2 text-xs text-gray-400">(siz)</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <span className="text-sm text-gray-500">{u.email}</span>
                      </td>
                      <td className="p-4 text-center">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleUpdate(u.id, e.target.value)}
                          disabled={u.id === currentUser?.id}
                          className={`px-2 py-1 text-xs font-medium rounded border-0 cursor-pointer ${roleColors[u.role] || 'bg-gray-50 text-gray-700'}`}
                        >
                          {roleOptions.map((r) => (
                            <option key={r} value={r}>{roleText[r]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 text-center hidden sm:table-cell">
                        <select
                          value={u.status}
                          onChange={(e) => handleStatusUpdate(u.id, e.target.value)}
                          disabled={u.id === currentUser?.id}
                          className={`px-2 py-1 text-xs font-medium rounded border-0 cursor-pointer ${statusColors[u.status] || 'bg-gray-50 text-gray-500'}`}
                        >
                          {statusOptions.map((s) => (
                            <option key={s} value={s}>{statusText[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        <span className="text-sm text-gray-500">
                          {u.lastLoginAt
                            ? new Date(u.lastLoginAt).toLocaleDateString('tr-TR')
                            : '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-10 h-10 text-sm border transition-colors ${
                      page === p
                        ? 'bg-black text-white border-black'
                        : 'border-gray-300 text-gray-600 hover:border-black'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

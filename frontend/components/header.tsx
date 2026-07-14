'use client';

import Link from 'next/link';
import { ShoppingBag, User, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore, useCartStore } from '@/lib/store';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();
  const { items } = useCartStore();

  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-light tracking-widest">
          D&G STORE
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/products"
            className="text-sm text-gray-600 hover:text-black transition-colors"
          >
            Tüm Ürünler
          </Link>
          <Link
            href="/products?category=elektronik"
            className="text-sm text-gray-600 hover:text-black transition-colors"
          >
            Elektronik
          </Link>
          <Link
            href="/products?category=aksesuar"
            className="text-sm text-gray-600 hover:text-black transition-colors"
          >
            Aksesuar
          </Link>
          <Link
            href="/products?category=spor"
            className="text-sm text-gray-600 hover:text-black transition-colors"
          >
            Spor
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          {/* Auth */}
          {isAuthenticated && user ? (
            <div className="hidden sm:flex items-center gap-4">
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  className="text-sm text-gray-600 hover:text-black transition-colors"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/account"
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-black transition-colors"
              >
                <User className="w-4 h-4" />
                <span className="hidden lg:block">{user.name}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-black transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-4">
              <Link
                href="/auth/login"
                className="text-sm text-gray-600 hover:text-black transition-colors"
              >
                Giriş
              </Link>
              <Link
                href="/auth/register"
                className="text-sm text-white bg-black px-4 py-2 hover:bg-gray-800 transition-colors"
              >
                Kayıt
              </Link>
            </div>
          )}

          {/* Cart */}
          <Link href="/cart" className="relative text-sm text-gray-600 hover:text-black transition-colors">
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-black text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-medium">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </Link>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-gray-600 hover:text-black transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100">
          <div className="px-6 py-4 space-y-4">
            <Link
              href="/products"
              className="block text-sm text-gray-600 hover:text-black transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Tüm Ürünler
            </Link>
            <Link
              href="/products?category=elektronik"
              className="block text-sm text-gray-600 hover:text-black transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Elektronik
            </Link>
            <Link
              href="/products?category=aksesuar"
              className="block text-sm text-gray-600 hover:text-black transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Aksesuar
            </Link>
            <Link
              href="/products?category=spor"
              className="block text-sm text-gray-600 hover:text-black transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Spor
            </Link>

            <hr className="border-gray-100" />

            {isAuthenticated ? (
              <>
                <Link
                  href="/account"
                  className="block text-sm text-gray-600 hover:text-black transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Hesabım
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="block text-sm text-gray-600 hover:text-black transition-colors"
                >
                  Çıkış Yap
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="block text-sm text-gray-600 hover:text-black transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Giriş
                </Link>
                <Link
                  href="/auth/register"
                  className="block text-sm text-gray-600 hover:text-black transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Kayıt Ol
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

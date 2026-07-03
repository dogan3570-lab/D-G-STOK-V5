import React from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  notifications?: number;
}

export default function Header({ title, subtitle, onRefresh, notifications = 0 }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-700 bg-slate-800 px-6">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            title="Yenile"
          >
            🔄
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            title="Cihaz Modu"
          >
            📱
          </button>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            title="Bildirimler"
          >
            🔔
          </button>
          {notifications > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {notifications}
            </span>
          )}
        </div>

        {/* User Menu */}
        <div className="flex items-center gap-3 border-l border-slate-700 pl-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 font-bold text-sm">
            Y
          </div>
          <div className="hidden md:block">
            <div className="text-sm font-medium text-white">Yönetici Admin</div>
            <div className="text-xs text-slate-400">admin@dgstok.com</div>
          </div>
        </div>
      </div>
    </header>
  );
}

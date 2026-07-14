import React, { useEffect, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: string;
  type: ToastType;
  text: string;
  duration?: number;
}

let toastListeners: Array<(msg: ToastMessage) => void> = [];

export function showToast(type: ToastType, text: string, duration = 4000) {
  const msg: ToastMessage = { id: Date.now().toString(), type, text, duration };
  toastListeners.forEach(fn => fn(msg));
}

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'border-green-500/20 bg-green-500/10 text-green-400',
  error: 'border-red-500/20 bg-red-500/10 text-red-400',
  info: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
  warning: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400',
};

const TYPE_ICONS: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️',
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((msg: ToastMessage) => {
    setToasts(prev => [...prev, msg]);
  }, []);

  useEffect(() => {
    toastListeners.push(addToast);
    return () => {
      toastListeners = toastListeners.filter(fn => fn !== addToast);
    };
  }, [addToast]);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm" aria-live="polite">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur-sm flex items-center gap-2 animate-slide-in ${TYPE_STYLES[toast.type]}`}
      role="alert"
    >
      <span>{TYPE_ICONS[toast.type]}</span>
      <span className="flex-1">{toast.text}</span>
      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        className="text-current opacity-60 hover:opacity-100"
        aria-label="Kapat"
      >
        ✕
      </button>
    </div>
  );
}

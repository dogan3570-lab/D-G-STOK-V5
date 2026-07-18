// ==================== DG STOK V5.0 - TEMA & ÇALIŞMA MODU SİSTEMİ ====================
// İki tema: Modern ERP (varsayılan) + Professional ERP (compact)
// Üç çalışma modu: Yönetici, Operasyon, Muhasebe
// =============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'modern' | 'professional';
export type DensityMode = 'wide' | 'normal' | 'compact';
export type WorkMode = 'yonetici' | 'operasyon' | 'muhasebe';

export interface ThemeConfig {
  theme: ThemeMode;
  density: DensityMode;
  workMode: WorkMode;
  chartSize: 'large' | 'medium' | 'small';
  setTheme: (t: ThemeMode) => void;
  setDensity: (d: DensityMode) => void;
  setWorkMode: (w: WorkMode) => void;
  setChartSize: (c: 'large' | 'medium' | 'small') => void;
}

const ThemeContext = createContext<ThemeConfig>({
  theme: 'modern', density: 'normal', workMode: 'yonetici', chartSize: 'large',
  setTheme: () => {}, setDensity: () => {}, setWorkMode: () => {}, setChartSize: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem('dgstok_theme') as ThemeMode) || 'modern');
  const [density, setDensity] = useState<DensityMode>(() => (localStorage.getItem('dgstok_density') as DensityMode) || 'normal');
  const [workMode, setWorkMode] = useState<WorkMode>(() => (localStorage.getItem('dgstok_workmode') as WorkMode) || 'yonetici');
  const [chartSize, setChartSize] = useState<'large' | 'medium' | 'small'>(() => (localStorage.getItem('dgstok_chartsize') as any) || 'large');

  useEffect(() => {
    localStorage.setItem('dgstok_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('dgstok_density', density);
    document.documentElement.setAttribute('data-density', density);
  }, [density]);

  useEffect(() => {
    localStorage.setItem('dgstok_workmode', workMode);
    document.documentElement.setAttribute('data-workmode', workMode);
  }, [workMode]);

  useEffect(() => {
    localStorage.setItem('dgstok_chartsize', chartSize);
    document.documentElement.setAttribute('data-chartsize', chartSize);
  }, [chartSize]);

  return (
    <ThemeContext.Provider value={{ theme, density, workMode, chartSize, setTheme, setDensity, setWorkMode, setChartSize }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useThemeConfig = () => useContext(ThemeContext);

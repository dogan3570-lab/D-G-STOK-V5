// Sunucuyu başlat ve hataları yakala
import('./apps/server/src/index.ts').catch(err => {
  console.error('HATA:', err);
  console.error('Stack:', err.stack);
  process.exit(1);
});

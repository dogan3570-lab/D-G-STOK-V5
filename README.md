# DG STOK V5.0

**XML Entegratör + ERP + Pazaryeri Yönetim Sistemi**

Modern, hızlı ve ölçeklenebilir XML entegrasyon sistemi. Tedarikçilerden XML/YML/CSV/Excel ile ürün çekme, kategorize etme, ve pazaryerlerine (Trendyol, Hepsiburada, Amazon, vb.) API ile gönderme.

## 🚀 Başlatma (Monorepo / Güncel)

### Seçenek A — Sadece yeni arayüzü çalıştır (önerilen)
```bash
# Proje kökünde
npm install
npm run dev
```
> Bu komut SADECE `apps/web` (yeni arayüz) başlatır.

### Seçenek B — Sadece backend (Node) çalıştır
```bash
npm run dev:server
```

### Seçenek C — Backend + yeni arayüz birlikte çalıştır
```bash
npm run dev:full
```

### Legacy FastAPI Notu
`backend/` ve README içindeki eski `frontend/` akışı legacy dökümana aittir.
Güncel web arayüz yolu: `apps/web`

## 📡 API Endpointleri

| Endpoint | Açıklama |
|----------|----------|
| `POST /api/v1/auth/login` | Kullanıcı girişi |
| `GET /api/v1/auth/me` | Mevcut kullanıcı |
| `GET /api/v1/dashboard/stats` | Dashboard istatistikleri |
| `GET /api/v1/suppliers` | Tedarikçi listesi |
| `POST /api/v1/suppliers` | Yeni tedarikçi ekle |
| `POST /api/v1/suppliers/{id}/sync` | XML senkronizasyonu |
| `GET /api/v1/products` | Ürün listesi |
| `GET /api/v1/categories` | Kategori listesi |
| `GET /api/v1/marketplaces` | Pazaryeri listesi |

## 👤 Giriş Bilgileri

- **E-posta:** admin@dgstok.com
- **Şifre:** admin123

## 🛢️ Teknolojiler

**Backend:**
- Python 3.11
- FastAPI
- SQLAlchemy
- PostgreSQL
- Redis
- Celery

**Frontend:**
- React 18
- TypeScript
- TailwindCSS
- Vite

## 📂 Proje Yapısı

```
DG STOK V5.0/
├── backend/
│   ├── app/
│   │   ├── api/routes/     # API endpointleri
│   │   ├── core/          # Config, DB, Security
│   │   ├── models/       # SQLAlchemy modelleri
│   │   └── services/     # İş mantığı
│   ├── alembic.ini       # DB migrations
│   └── requirements.txt
├── apps/
│   ├── web/              # Güncel React + Vite arayüzü
│   └── server/           # Node/TS backend servisleri
├── docker-compose.yml
└── README.md
```

## 📝 Yapılacaklar

- [ ] XML/YML/CSV/Excel parser
- [ ] Otomatik kategori/marka/varyant eşleştirme (AI)
- [ ] Pazaryeri API entegrasyonları (Trendyol, Hepsiburada, Amazon...)
- [ ] Listing şablonları yönetimi
- [ ] Sipariş yönetimi
- [ ] Celery job queue (toplu işlemler)
- [ ] Test suite

## Lisans

MIT License

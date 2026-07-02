# Node kurulum / çalışma komutları

## Varsayımlar
- Monorepo: `apps/server` (Express) + `apps/web` (Vite React)
- Docker compose: Postgres + Redis

## Adımlar
1) Node modülleri
- Kök dizinde:
  - `npm install`

2) Veritabanı + Redis
- `docker compose up -d`

3) Env dosyası
- `apps/server` için `.env` üret (en azından aşağıdakiler):
  - `DATABASE_URL=postgresql://stok:stok@localhost:5432/stokmant`
  - `REDIS_URL=redis://localhost:6379`
  - `JWT_SECRET=change-me-please`
  - (opsiyonel) `CORS_ORIGIN=http://localhost:5173`

4) Prisma migrate
- `npx prisma migrate dev --name init --schema prisma/schema.prisma`

5) Dev server
- `npm run dev`

## Kontrol
- Backend health: `http://localhost:4000/health`
- Frontend: `http://localhost:5173`


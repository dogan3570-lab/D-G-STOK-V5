@echo off
title DG STOK V5.0
echo ========================================
echo   DG STOK V5.0 - Baslatma Scripti
echo ========================================
echo.

cd /d "%~dp0"

:: .env dosyası yoksa oluştur
if not exist ".env" (
    echo [INFO] .env dosyasi bulunamadi, olusturuluyor...
    echo DATABASE_URL=file:./dev.db > .env
    echo JWT_SECRET=dgstok-dev-secret-key >> .env
    echo PORT=4000 >> .env
    echo CORS_ORIGIN=http://localhost:3000 >> .env
)

:: Prisma generate
echo [1/4] Prisma hazirlaniyor...
call npx prisma generate >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [HATA] Prisma generate basarisiz!
    pause
    exit /b 1
)

:: Veritabanını oluştur
echo [2/4] Veritabani hazirlaniyor...
call npx prisma db push --accept-data-loss >nul 2>&1

:: Server'ı başlat
echo [3/4] Server baslatiliyor (port 4000)...
start "DG STOK Server" cmd /c "cd /d "%~dp0apps\server" && npx tsx src/index.ts"

:: Biraz bekle
timeout /t 3 /nobreak >nul

:: Web UI'ı başlat
echo [4/4] Web UI baslatiliyor (port 3000)...
start "DG STOK Web" cmd /c "cd /d "%~dp0apps\web" && npx vite --port 3000 --host"

echo.
echo ========================================
echo   Server: http://localhost:4000
echo   Web UI: http://localhost:3000
echo ========================================
echo.
echo  Admin kullanici olusturmak icin:
echo  http://localhost:4000/debug/seed-admin (POST)
echo.
pause

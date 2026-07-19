@echo off
title DG STOK V5.0
cd /d "%~dp0"

echo ========================================
echo   DG STOK V5.0 - Baslatma Scripti
echo ========================================
echo.

:: Port 4000'deki eski process'leri temizle
echo [Temizlik] Eski process'ler kontrol ediliyor...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

:: .env dosyasi yoksa olustur (proje kokunde + apps/server icin)
if not exist ".env" (
    echo [INFO] .env dosyasi bulunamadi, olusturuluyor...
    copy .env.example .env >nul 2>&1
)

:: Prisma generate (proje kokunden calis)
echo [1/5] Prisma hazirlaniyor...
call npx prisma generate >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [HATA] Prisma generate basarisiz!
    pause
    exit /b 1
)
echo       Prisma generate tamam.

:: Veritabanini olustur
echo [2/5] Veritabani hazirlaniyor...
call npx prisma db push --accept-data-loss >nul 2>&1
echo       Veritabani hazir.

:: Frontend build (yoksa build et)
echo [3/5] Frontend kontrol ediliyor...
if not exist "apps\web\dist" (
    echo       Frontend build ediliyor...
    cd apps\web
    call npx vite build >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [HATA] Frontend build basarisiz!
        pause
        exit /b 1
    )
    cd ..
    echo       Frontend build tamam.
) else (
    echo       Frontend build mevcut.
)

:: Server'i baslat (proje kokunden, boylece .env dosyasi bulunur)
echo [4/5] Server baslatiliyor (port 4000)...
start "DG STOK Server" cmd /c "cd /d "%~dp0" && set NODE_ENV=production && npx tsx apps/server/src/index.ts"

:: Biraz bekle (server'in baslamasi icin)
timeout /t 4 /nobreak >nul

:: Web UI (Vite dev)
echo [5/5] Web UI baslatiliyor (port 3000)...
start "DG STOK Web" cmd /c "cd /d "%~dp0apps\web" && npx vite --port 3000 --host"

echo.
echo ========================================
echo   DG STOK V5.0 BASLATILDI
echo ========================================
echo.
echo  Admin Panel:  http://localhost:4000
echo  Web UI:       http://localhost:3000
echo  API:          http://localhost:4000/health
echo.
echo  Giris: admin@dgstok.com / admin123
echo.
echo  NOT: Tarayicida Ctrl+F5 yaparak onbellegi temizleyin
echo.
pause

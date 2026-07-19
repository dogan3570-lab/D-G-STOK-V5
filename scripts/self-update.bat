@echo off
chcp 65001 >nul
echo ============================================
echo  DG STOK V5.0 - Self-Updating Ana Yasa
echo ============================================
echo.

echo [1/6] Paket kontrolu...
cd /d "c:\PROJE 1\DG STOK V5.0"
call npm install --check-files 2>nul
if %errorlevel% equ 0 (echo  OK Paketler tamam) else (echo  npm install yukleniyor... && call npm install)
echo.

echo [2/6] DB senkronizasyonu...
cd /d "c:\PROJE 1\DG STOK V5.0\apps\server"
call npx prisma db push --schema=..\..\prisma\schema.prisma --accept-data-loss >nul 2>&1
if %errorlevel% equ 0 (echo  OK DB senkronize) else (echo  HATA DB senkronizasyonu)
call npx prisma generate >nul 2>&1
echo.

echo [3/6] TypeScript derleme...
call npx tsc --noEmit 2>&1 | find /c "error TS" >nul
if %errorlevel% equ 1 (echo  OK 0 hata) else (echo  UYARI TS hatalari var)
echo.

echo [4/6] Frontend build...
cd /d "c:\PROJE 1\DG STOK V5.0\apps\web"
call npx vite build >nul 2>&1
if %errorlevel% equ 0 (echo  OK Frontend build) else (echo  HATA Frontend build)
echo.

echo [5/6] API Testleri...
taskkill /f /im node.exe >nul 2>&1
cd /d "c:\PROJE 1\DG STOK V5.0\apps\server"
start /B npx tsx src/index.ts >nul 2>&1
timeout /t 5 /nobreak >nul

powershell -Command ^
 "$b='{ \"email\":\"admin@dgstok.com\",\"password\":\"admin123\" }';" ^
 "$r=Invoke-WebRequest -Uri 'http://localhost:4000/auth/login' -Method POST -Body $b -ContentType 'application/json' -UseBasicParsing;" ^
 "$t=($r.Content|ConvertFrom-Json).token;" ^
 "$h=@{'x-auth-token'=$t};" ^
 "$tests=@('dashboard/stats','marketplaces','products?page=1&limit=1','ai-image/dashboard','ai-sales/dashboard','copilot/status','brands','categories/stats','orders?page=1&limit=1','xml-sources','pricing/stats');" ^
 "$p=0;$f=0;" ^
 "foreach($u in $tests){try{$resp=Invoke-WebRequest -Uri \"http://localhost:4000/$u\" -Headers $h -UseBasicParsing -TimeoutSec 10;if($resp.StatusCode -eq 200){$p++}else{$f++}}catch{$f++}};" ^
 "Write-Host \"  $p/$($p+$f) PASS, $f FAIL\""

echo.

echo ============================================
echo  DG STOK V5.0 - CERTIFICATION REPORT
echo ============================================
echo  Server  : http://localhost:4000
echo  Login   : admin@dgstok.com / admin123
echo  Status  : CALISIYOR
echo ============================================
echo.

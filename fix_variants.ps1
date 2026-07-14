$f = "C:\PROJE 1\DG STOK V5.0\apps\web\src\pages\Variants.tsx"
$c = Get-Content $f -Raw

# Add import
$import = "import { apiFetch } from '../lib/api';`r`n"
$c = $import + $c

# Replace fetch calls
$c = $c -replace "fetch\(`"/variants", "apiFetch(`"/variants"
$c = $c -replace "fetch\(`"/products", "apiFetch(`"/products"
$c = $c -replace ", credentials: 'include' ", ", "
$c = $c -replace ", credentials: 'include'}", "}"
$c = $c -replace ", credentials: 'include'\)", ")"

Set-Content $f $c
Write-Host "DUZELTILDI"

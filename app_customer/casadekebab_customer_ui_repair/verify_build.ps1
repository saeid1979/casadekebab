param(
    [string]$Project = "D:\Python_project\casadekebab\app_customer"
)

$ErrorActionPreference = "Stop"

Write-Host "Checking repaired UI..." -ForegroundColor Cyan

Select-String `
  -Path (Join-Path $Project "src\styles.css") `
  -Pattern "customer UI repair v1|repeat\(5|height: 118px|object-fit: contain"

Select-String `
  -Path (Join-Path $Project "index.html") `
  -Pattern "viewport-fit=cover"

Select-String `
  -Path (Join-Path $Project "android\app\src\main\AndroidManifest.xml") `
  -Pattern "windowSoftInputMode"

Push-Location $Project
try {
    npm run build
    npx cap sync android
}
finally {
    Pop-Location
}

Write-Host "Build and Android sync completed." -ForegroundColor Green

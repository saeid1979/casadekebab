param(
    [string]$Project = "D:\Python_project\casadekebab\app_customer"
)

$ErrorActionPreference = "Stop"

function Require-Path {
    param([string]$PathToCheck, [string]$Label)
    if (-not (Test-Path $PathToCheck)) {
        throw "$Label not found: $PathToCheck"
    }
}

Write-Host "=== Casa de Kebab Turco - Rollback two customer-app UI stages ===" -ForegroundColor Cyan
Write-Host "Project: $Project"

Require-Path $Project "Customer app project"

$safeBackup = Get-ChildItem $Project -Directory -Filter "_backup_safe_area_*" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

$uiBackup = Get-ChildItem $Project -Directory -Filter "_backup_before_ui_repair_*" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $safeBackup) {
    throw "No _backup_safe_area_* folder was found in $Project"
}

if (-not $uiBackup) {
    throw "No _backup_before_ui_repair_* folder was found in $Project"
}

Write-Host "Safe-area backup selected:" -ForegroundColor Yellow
Write-Host "  $($safeBackup.FullName)"
Write-Host "UI-repair backup selected:" -ForegroundColor Yellow
Write-Host "  $($uiBackup.FullName)"

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$emergency = Join-Path $Project "_backup_before_two_step_rollback_$timestamp"

$pathsToBackup = @(
    "index.html",
    "src\styles.css",
    "src\utils\cloudinaryImage.js",
    "android\app\src\main\AndroidManifest.xml"
)

foreach ($relative in $pathsToBackup) {
    $source = Join-Path $Project $relative
    if (Test-Path $source) {
        $destination = Join-Path $emergency $relative
        $destinationDir = Split-Path $destination -Parent
        New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
        Copy-Item $source $destination -Force
    }
}

Write-Host "Emergency backup created:" -ForegroundColor Green
Write-Host "  $emergency"

$restoreFromSafe = @(
    "index.html",
    "src\styles.css",
    "android\app\src\main\AndroidManifest.xml"
)

foreach ($relative in $restoreFromSafe) {
    $source = Join-Path $safeBackup.FullName $relative
    $destination = Join-Path $Project $relative

    Require-Path $source "Rollback source file"

    $destinationDir = Split-Path $destination -Parent
    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
    Copy-Item $source $destination -Force

    Write-Host "Restored: $relative" -ForegroundColor Green
}

$cloudinaryBackup = Join-Path $uiBackup.FullName "src\utils\cloudinaryImage.js"
$cloudinaryTarget = Join-Path $Project "src\utils\cloudinaryImage.js"

if (Test-Path $cloudinaryBackup) {
    $targetDir = Split-Path $cloudinaryTarget -Parent
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    Copy-Item $cloudinaryBackup $cloudinaryTarget -Force
    Write-Host "Restored: src\utils\cloudinaryImage.js" -ForegroundColor Green
}
else {
    Write-Host "cloudinaryImage.js was not present in the UI backup; no change was made to it." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Checking that the two UI patches are gone..." -ForegroundColor Cyan

$stylesPath = Join-Path $Project "src\styles.css"
$matches = Select-String `
    -Path $stylesPath `
    -Pattern "mobile system navigation safe-area fix v2|customer UI repair v1" `
    -ErrorAction SilentlyContinue

if ($matches) {
    Write-Host "Warning: patch markers still exist in styles.css" -ForegroundColor Yellow
    $matches | ForEach-Object { Write-Host $_.Line }
}
else {
    Write-Host "Patch markers are no longer present." -ForegroundColor Green
}

Write-Host ""
Write-Host "Rollback completed successfully." -ForegroundColor Green
Write-Host "Next commands:"
Write-Host "  cd `"$Project`""
Write-Host "  npm run build"
Write-Host "  npx cap sync android"
Write-Host "  npx cap open android"

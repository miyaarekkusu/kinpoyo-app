# Deploy kinpoyo backend to Azure App Service.
# Usage:
#   cd backend
#   .\deploy.ps1
[CmdletBinding()]
param(
    [string]$ResourceGroup = 'kinpoyo-rg',
    [string]$AppName       = 'kinpoyo-api',
    [string]$ZipPath       = "$env:TEMP\kinpoyo-backend.zip"
)

$ErrorActionPreference = 'Stop'
$start = Get-Date

# Always run from this script's directory so relative file names work.
Set-Location -LiteralPath $PSScriptRoot

$files = @('main.py', 'database.py', 'pose.py', 'requirements.txt')
foreach ($f in $files) {
    if (-not (Test-Path -LiteralPath $f)) {
        throw "Missing file: $f"
    }
}

Write-Host "Packaging $($files.Count) files -> $ZipPath" -ForegroundColor Cyan
if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }
Compress-Archive -LiteralPath $files -DestinationPath $ZipPath -CompressionLevel Optimal

$size = [math]::Round((Get-Item $ZipPath).Length / 1KB, 1)
Write-Host "  zip size: $size KB" -ForegroundColor DarkGray

Write-Host "Deploying to $AppName ..." -ForegroundColor Cyan
az webapp deploy `
    --resource-group $ResourceGroup `
    --name $AppName `
    --src-path $ZipPath `
    --type zip `
    --timeout 1200 `
    --output none

if ($LASTEXITCODE -ne 0) {
    throw "az webapp deploy returned exit code $LASTEXITCODE"
}

$elapsed = [math]::Round(((Get-Date) - $start).TotalSeconds, 1)
Write-Host "Done in ${elapsed}s. URL: https://$AppName.azurewebsites.net" -ForegroundColor Green

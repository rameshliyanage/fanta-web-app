# Build locally and publish the static SPA to the DigitalOcean origin.
# Usage:
#   .\deploy\publish.ps1 -DropletHost 1.2.3.4
#   .\deploy\publish.ps1 -DropletHost 1.2.3.4 -IdentityFile C:\path\to\id_ed25519
#   .\deploy\publish.ps1 -DropletHost 1.2.3.4 -WithCerts
param(
  [Parameter(Mandatory = $true)]
  [string]$DropletHost,
  [string]$User = "root",
  [string]$IdentityFile = "",
  [string]$CertPem = "$env:USERPROFILE\Downloads\ingameglobal.pem",
  [string]$CertKey = "$env:USERPROFILE\Downloads\ingameglobal.key",
  [switch]$WithCerts,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Invoke-Remote {
  param([string]$RemoteCommand)
  $ssh = @("-o", "StrictHostKeyChecking=accept-new", "${User}@${DropletHost}", $RemoteCommand)
  if ($IdentityFile) { $ssh = @("-i", $IdentityFile) + $ssh }
  & ssh @ssh
  if ($LASTEXITCODE -ne 0) { throw "ssh failed: $RemoteCommand" }
}

function Copy-ToRemote {
  param([string]$Local, [string]$Remote)
  $scp = @("-o", "StrictHostKeyChecking=accept-new", $Local, "${User}@${DropletHost}:${Remote}")
  if ($IdentityFile) { $scp = @("-i", $IdentityFile) + $scp }
  & scp @scp
  if ($LASTEXITCODE -ne 0) { throw "scp failed: $Local -> $Remote" }
}

if (-not $SkipBuild) {
  Write-Host "==> npm run build"
  npm run build
}

$dist = Join-Path $RepoRoot "dist"
if (-not (Test-Path (Join-Path $dist "index.html"))) {
  throw "dist/index.html missing. Build failed?"
}

Write-Host "==> Ensure origin directories"
Invoke-Remote "mkdir -p /var/www/fanta /tmp/fanta-dist /etc/nginx/sites-available"

if ($WithCerts) {
  if (-not (Test-Path $CertPem) -or -not (Test-Path $CertKey)) {
    throw "Cert files not found: $CertPem / $CertKey"
  }
  Write-Host "==> Upload Cloudflare Origin cert to /home/"
  Copy-ToRemote $CertPem "/home/ingameglobal.pem"
  Copy-ToRemote $CertKey "/home/ingameglobal.key"
  Invoke-Remote "chmod 644 /home/ingameglobal.pem && chmod 600 /home/ingameglobal.key"
}

Write-Host "==> Upload nginx site + setup script"
Copy-ToRemote (Join-Path $PSScriptRoot "nginx.conf") "/tmp/fanta-nginx.conf"
Copy-ToRemote (Join-Path $PSScriptRoot "setup-server.sh") "/tmp/setup-fanta.sh"
Invoke-Remote "bash /tmp/setup-fanta.sh /tmp/fanta-nginx.conf"

Write-Host "==> Sync dist/"
$sshArgs = @("-o", "StrictHostKeyChecking=accept-new")
if ($IdentityFile) { $sshArgs = @("-i", $IdentityFile) + $sshArgs }
tar -C $dist -cf - . | & ssh @sshArgs "${User}@${DropletHost}" "tar -C /var/www/fanta -xf -"
if ($LASTEXITCODE -ne 0) { throw "dist sync failed" }

Invoke-Remote "chown -R www-data:www-data /var/www/fanta && nginx -t && systemctl reload nginx"
Write-Host "==> Live: https://fanta-dmasl26-421419912123poc.ingame.global"

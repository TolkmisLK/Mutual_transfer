param([string]$OutputDirectory = (Join-Path $PSScriptRoot '..\dist'))
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:OS -ne 'Windows_NT') { throw 'Build this portable Windows bundle on Windows.' }
$Root = Split-Path $PSScriptRoot -Parent
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$Version = (Get-Content -LiteralPath (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json).version
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Unexpected version format' }
$Name = "mutual-transfer-$Version-preview-windows-x64"
$Zip = Join-Path $OutputDirectory "$Name.zip"
if (Test-Path -LiteralPath $Zip) { throw 'Refusing to replace an existing portable archive' }
$Temp = Join-Path ([IO.Path]::GetTempPath()) ('mutual-package-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Temp | Out-Null
try {
  # Published checksum verified against the official Node 24.21.0 release page.
  $NodeVersion = '24.21.0'
  $NodeHash = '158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541'
  $NodeZip = Join-Path $Temp 'node.zip'
  Invoke-WebRequest -Uri "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip" -OutFile $NodeZip -TimeoutSec 180
  if ((Get-FileHash -LiteralPath $NodeZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $NodeHash) { throw 'Node archive checksum mismatch' }
  Expand-Archive -LiteralPath $NodeZip -DestinationPath (Join-Path $Temp 'node')
  $Node = Join-Path $Temp "node\node-v$NodeVersion-win-x64"
  $Bundle = Join-Path $Temp $Name
  New-Item -ItemType Directory -Path (Join-Path $Bundle 'runtime') -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $Node 'node.exe') -Destination (Join-Path $Bundle 'runtime\node.exe')
  Copy-Item -LiteralPath (Join-Path $Node 'LICENSE') -Destination (Join-Path $Bundle 'runtime\NODE-LICENSE.txt')
  $Files = @('package.json', 'LICENSE', 'README.md', 'src/server.js', 'src/store.js', 'src/pairing.js',
    'public/index.html', 'public/app.js', 'public/integrity.js', 'public/style.css', 'tool/portable-launch.js',
    'docs/HTTPS.md', 'docs/PAIRING.md', 'docs/WINDOWS-PORTABLE.md', 'docs/VALIDATION.md')
  foreach ($File in $Files) {
    $Destination = Join-Path $Bundle $File
    New-Item -ItemType Directory -Path (Split-Path $Destination -Parent) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $Root $File) -Destination $Destination
  }
  Copy-Item -LiteralPath (Join-Path $Root 'tool\START-WINDOWS.cmd') -Destination (Join-Path $Bundle 'START-WINDOWS.cmd')
  $Vendor = Join-Path $Bundle 'node_modules\@noble\hashes'
  New-Item -ItemType Directory -Path $Vendor -Force | Out-Null
  foreach ($File in @('sha2.js', '_md.js', '_u64.js', 'utils.js', 'LICENSE')) {
    Copy-Item -LiteralPath (Join-Path $Root "node_modules\@noble\hashes\$File") -Destination (Join-Path $Vendor $File)
  }
  $Manifest = @{}
  foreach ($File in Get-ChildItem -LiteralPath $Bundle -File -Recurse) {
    $Relative = [IO.Path]::GetRelativePath($Bundle, $File.FullName).Replace('\', '/')
    $Manifest[$Relative] = (Get-FileHash -LiteralPath $File.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  $Manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Bundle 'FILES.sha256.json') -Encoding utf8
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
  Compress-Archive -LiteralPath $Bundle -DestinationPath $Zip -CompressionLevel Optimal
  $Hash = (Get-FileHash -LiteralPath $Zip -Algorithm SHA256).Hash.ToLowerInvariant()
  "$Hash  $Name.zip" | Set-Content -LiteralPath "$Zip.sha256" -Encoding ascii
  Write-Output $Zip
} finally {
  # Only a newly generated packaging directory, never an application data dir.
  Remove-Item -LiteralPath $Temp -Recurse -Force
}

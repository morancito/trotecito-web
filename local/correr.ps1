# Trotecito · corre el programa de precios. Lo usa la tarea programada; a mano: correr.ps1 -Ver
param([switch]$Ver)
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$dir = $PSScriptRoot
$log = Join-Path $dir "registro.txt"
$node = (Get-Content (Join-Path $dir "node.txt") -ErrorAction SilentlyContinue | Select-Object -First 1)
if (-not $node -or -not (Test-Path $node)) { $node = "node" }
$env:TROTECITO_TOKEN = [System.Net.NetworkCredential]::new("", (Get-Content (Join-Path $dir "token.txt") | ConvertTo-SecureString)).Password
"`r`n===== $(Get-Date -Format 'yyyy-MM-dd HH:mm') =====" | Out-File -Append -Encoding utf8 $log
Push-Location $dir
try {
  & $node "trotecito-precios.mjs" 2>&1 | ForEach-Object { "$_" } | Tee-Object -Variable salida | Out-File -Append -Encoding utf8 $log
  if ($Ver) { $salida | ForEach-Object { Write-Host $_ } }
} finally { Pop-Location; Remove-Item Env:TROTECITO_TOKEN -ErrorAction SilentlyContinue }
# el registro guarda las últimas ~2000 líneas
$l = Get-Content $log -Encoding utf8
if ($l.Count -gt 2000) { $l | Select-Object -Last 2000 | Set-Content $log -Encoding utf8 }

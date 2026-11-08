# Trotecito · instalador del programa de precios (Windows 10/11)
# Lo abre instalar.cmd. Hace cuatro cosas: se fija que tengas Node, copia el programa a tu usuario,
# guarda tu token de GitHub cifrado (solo tu usuario de Windows lo puede leer) y crea la tarea que lo corre
# todos los días a las 08:30 y a las 12:30.
$ErrorActionPreference = "Stop"
$dest = Join-Path $env:LOCALAPPDATA "Trotecito"
$tarea = "Trotecito precios"
Write-Host ""
Write-Host "Trotecito · programa de precios" -ForegroundColor Green
Write-Host ""

# 1) Node 18 o más nuevo
function Buscar-Node {
  $c = Get-Command node -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  $p = Join-Path $env:ProgramFiles "nodejs\node.exe"
  if (Test-Path $p) { return $p }
  return $null
}
$node = Buscar-Node
if ($node) {
  $v = [int]((& $node -v) -replace '^v(\d+).*', '$1')
  if ($v -lt 18) { Write-Host "Tenés Node $v y hace falta el 18 o más nuevo. Lo actualizo..."; $node = $null }
}
if (-not $node) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw "Falta Node. Bajalo de https://nodejs.org (versión LTS), instalalo y abrí instalar.cmd de nuevo." }
  Write-Host "Instalo Node (lo necesita el programa). Puede pedirte permiso de administrador..."
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  $node = Buscar-Node
  if (-not $node) { throw "No pude instalar Node. Bajalo de https://nodejs.org (versión LTS), instalalo y abrí instalar.cmd de nuevo." }
}
Write-Host "Node: OK ($(& $node -v))"

# 2) el programa
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Force (Join-Path $PSScriptRoot "trotecito-precios.mjs"), (Join-Path $PSScriptRoot "correr.ps1"), (Join-Path $PSScriptRoot "desinstalar.ps1") $dest
Get-ChildItem $dest -File | Unblock-File
Set-Content -Path (Join-Path $dest "node.txt") -Value $node -Encoding UTF8
Write-Host "Programa copiado a $dest"

# 3) el token de GitHub, cifrado con tu usuario de Windows (DPAPI). No se muestra ni se guarda en texto.
$archToken = Join-Path $dest "token.txt"
$usar = $true
if (Test-Path $archToken) { $usar = (Read-Host "Ya hay un token guardado. ¿Lo cambiás? (s/n)") -match '^[sS]' }
if ($usar) {
  Write-Host ""
  Write-Host "Pegá el token de GitHub (el que empieza con github_pat_) y apretá Enter."
  Write-Host "No se ve mientras lo pegás: es a propósito. Clic derecho pega en esta ventana."
  $seguro = Read-Host "Token" -AsSecureString
  $plano = [System.Net.NetworkCredential]::new("", $seguro).Password.Trim()
  if (-not $plano) { throw "No pegaste nada. Abrí instalar.cmd de nuevo." }
  try {
    $r = Invoke-RestMethod -Uri "https://api.github.com/repos/morancito/trotecito-web" -Headers @{ Authorization = "Bearer $plano"; "User-Agent" = "trotecito-local" }
    Write-Host "Token: OK (llega a $($r.full_name))"
  } catch { throw "GitHub no aceptó ese token o no tiene acceso a trotecito-web. Revisá los pasos del LEEME y probá de nuevo." }
  ConvertFrom-SecureString $seguro | Set-Content -Path $archToken -Encoding ASCII
  $plano = $null
}

# 4) la tarea programada: 08:30 y 12:30 (si la compu estaba apagada, corre apenas la prendés)
$accion = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$dest\correr.ps1`""
$horas = @((New-ScheduledTaskTrigger -Daily -At "08:30"), (New-ScheduledTaskTrigger -Daily -At "12:30"))
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 40) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $tarea -Action $accion -Trigger $horas -Settings $ajustes -Description "Lee precios de Nike, adidas y Digital Sport y los sube a Trotecito" -Force | Out-Null
Write-Host "Tarea programada: OK (todos los días 08:30 y 12:30)"

Write-Host ""
if ((Read-Host "¿Lo corro ahora una vez para probar? Tarda unos 15 minutos (s/n)") -match '^[sS]') {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$dest\correr.ps1" -Ver
}
Write-Host ""
Write-Host "Listo. Lo que pasó en cada corrida queda en $dest\registro.txt" -ForegroundColor Green

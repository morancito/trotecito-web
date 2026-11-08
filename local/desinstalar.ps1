# Trotecito · desinstalar: borra la tarea programada, el token guardado y el programa
Unregister-ScheduledTask -TaskName "Trotecito precios" -Confirm:$false -ErrorAction SilentlyContinue
$dest = Join-Path $env:LOCALAPPDATA "Trotecito"
Set-Location $env:TEMP
Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue
Write-Host "Listo: sacado de la compu. El token sigue existiendo en GitHub: borralo en github.com/settings/tokens si no lo vas a usar más."

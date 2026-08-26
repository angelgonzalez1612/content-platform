$ErrorActionPreference = "Stop"
# content-radar se fusiono a content-platform (dejo de ser repo aparte) - ruta actualizada.
Set-Location "C:\repositorios\personal\content-platform\apps\content-radar"
New-Item -ItemType Directory -Force -Path "reports" | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"---- $timestamp ----" | Out-File -Append -Encoding utf8 -FilePath "reports\run.log"

& "C:\Program Files\nodejs\npx.cmd" tsx src/index.ts --geo=MX --site=cdmx 2>&1 |
    Out-File -Append -Encoding utf8 -FilePath "reports\run.log"

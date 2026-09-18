$ErrorActionPreference = "Stop"
Set-Location "C:\repositorios\personal\content-platform"
New-Item -ItemType Directory -Force -Path "backups" | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"---- $timestamp ----" | Out-File -Append -Encoding utf8 -FilePath "backups\backup-run.log"

wsl -e bash -c "/mnt/c/repositorios/personal/content-platform/scripts/backup-turso.sh" 2>&1 |
    Out-File -Append -Encoding utf8 -FilePath "backups\backup-run.log"

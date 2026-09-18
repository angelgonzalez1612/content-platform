#!/usr/bin/env bash
# Respaldo completo (esquema + datos) de la base de datos de Turso, vía el
# CLI oficial conectado directo con DATABASE_URL/DATABASE_AUTH_TOKEN de
# apps/api/.env — sin necesitar `turso auth login` (esa cuenta nunca llegó a
# autenticarse por WSL headless, ver notas de la sesión que lo armó).
#
# Uso (desde WSL, o `wsl -e bash scripts/backup-turso.sh` desde Windows):
#   ./scripts/backup-turso.sh
#
# Requiere el CLI de Turso instalado en ~/.turso/turso (instalado en WSL con
# el script oficial: curl -sSfL https://get.tur.so/install.sh | bash).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/apps/api/.env"
BACKUP_DIR="$REPO_ROOT/backups"
TURSO_BIN="$HOME/.turso/turso"

if [ ! -f "$ENV_FILE" ]; then
  echo "No se encontró $ENV_FILE" >&2
  exit 1
fi
if [ ! -x "$TURSO_BIN" ]; then
  echo "No se encontró el CLI de Turso en $TURSO_BIN — instálalo con: curl -sSfL https://get.tur.so/install.sh | bash" >&2
  exit 1
fi

URL="$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | sed 's|^libsql://|https://|')"
TOKEN="$(grep '^DATABASE_AUTH_TOKEN=' "$ENV_FILE" | cut -d= -f2-)"

mkdir -p "$BACKUP_DIR"
OUT_FILE="$BACKUP_DIR/turso-backup-$(date +%Y-%m-%d-%H%M).sql"

"$TURSO_BIN" db shell "${URL}?authToken=${TOKEN}" ".dump" > "$OUT_FILE"

echo "Respaldo guardado en $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

# Se queda con los últimos 14 respaldos nada más, para no llenar el disco.
ls -1t "$BACKUP_DIR"/turso-backup-*.sql | tail -n +15 | xargs -r rm -f

# Segunda copia por FTP (opcional) — al hosting de Planazo, fuera de
# public_html (nunca dentro: sería descargable por cualquiera desde
# internet). Si no existe scripts/.ftp-credentials, se omite en silencio —
# cada máquina la llena a mano, nunca va al repo (ver .gitignore).
FTP_CREDS="$REPO_ROOT/scripts/.ftp-credentials"
if [ -f "$FTP_CREDS" ]; then
  # shellcheck disable=SC1090
  source "$FTP_CREDS"
  if curl -s --connect-timeout 15 --user "${FTP_USER}:${FTP_PASS}" -T "$OUT_FILE" \
    "ftp://${FTP_HOST}:${FTP_PORT}${FTP_DIR}/$(basename "$OUT_FILE")"; then
    echo "Segunda copia subida por FTP a ${FTP_HOST}${FTP_DIR}/$(basename "$OUT_FILE")"
  else
    echo "Aviso: la subida por FTP falló — el respaldo local en $BACKUP_DIR sigue intacto." >&2
  fi
else
  echo "scripts/.ftp-credentials no existe — se omite la segunda copia por FTP."
fi

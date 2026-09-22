#!/usr/bin/env bash
#
# build.sh — Constrúe a extensión "Busca mensaxes Abalar" para Firefox e Chrome.
#
# Uso:
#   ./build.sh                    # xera dist/abalar-vX.Y.Z.xpi   (Firefox)
#   ./build.sh firefox            # idem (explícito)
#   ./build.sh chrome             # xera dist/abalar-chrome-vX.Y.Z.zip (Chrome)
#   ./build.sh --check [destino]  # só valida o manifest escollido
#
# Requisitos: zip (ou python3 como fallback).

set -euo pipefail

cd "$(dirname "$0")"

NOME="abalar-busca-mensaxes"
DIST="dist"

DESTINO="firefox"
MODE=""
for arg in "$@"; do
	case "$arg" in
		chrome|firefox) DESTINO="$arg" ;;
		--check) MODE="check" ;;
	esac
done

[[ "$DESTINO" == "chrome" ]] && MANIFEST="manifest-chrome.json" || MANIFEST="manifest.json"
[[ "$MODE" == "check" ]] && EXTLABEL="(check)" || EXTLABEL=""

# Versión tomada do manifest de Firefox (ambos comparten versión).
VER="$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])" 2>/dev/null \
    || node -e "console.log(require('./manifest.json').version)")"

echo "== Construción da extensión v${VER} para $DESTINO ${EXTLABEL}=="

# 1. Validar o manifest escollido
if [[ "$DESTINO" == "firefox" ]]; then
	python3 - <<'PY'
import json, re
with open('manifest.json', encoding='utf-8') as f:
    m = json.load(f)

padrao = re.compile(r'^[a-z0-9-._]*@[a-z0-9-._]+$', re.I)
g = m.get('browser_specific_settings', {}).get('gecko', {})
idd = g.get('id', '')
if not idd:
    raise SystemExit('ERRO: falta browser_specific_settings.gecko.id (obrigatorio en MV3 para AMO).')
if not padrao.match(idd):
    raise SystemExit(f'ERRO: o ID "{idd}" non é válido para Firefox.')
print(f"   manifest OK (id: {idd})")

dcp = g.get('data_collection_permissions')
if not dcp or 'none' not in (dcp.get('required') or []):
    raise SystemExit('ERRO: falta browser_specific_settings.gecko.data_collection_permissions "'\
                     'required":["none"] (obrigatorio para novos complementos en AMO).')
print(f"   data_collection_permissions OK (required: {dcp.get('required')})")

dt = g.get('strict_min_version', '')
ga = m.get('browser_specific_settings', {}).get('gecko_android', {}).get('strict_min_version', '')
if dt and dt.split('.')[0] < '140':
    raise SystemExit('ERRO: strict_min_version (Desktop) debe ser >= 140.0 co data_collection_permissions.')
if ga and ga.split('.')[0] < '142':
    raise SystemExit('ERRO: gecko_android.strict_min_version debe ser >= 142.0.')
print(f"   versións mínimas OK (desktop: {dt or '-'}, android: {ga or '-'})")
PY
else
	python3 - <<'PY'
import json
for f in ('manifest-chrome.json', 'manifest.json'):
    with open(f, encoding='utf-8') as fh:
        m = json.load(fh)
    if m.get('manifest_version') != 3:
        raise SystemExit(f'ERRO: {f} non é manifest_version 3.')
    if not m.get('content_scripts'):
        raise SystemExit(f'ERRO: {f} sen content_scripts.')
    # A versión debe coincidir co manifest de Firefox
    with open('manifest.json', encoding='utf-8') as fh:
        if json.load(fh)['version'] != m['version']:
            raise SystemExit(f'ERRO: versión de {f} distinta do manifest de Firefox.')
print('   manifest-chrome OK (MV3, content_scripts, versión sincronizada)')
PY
fi

if [[ "$MODE" == "check" ]]; then
	echo "--- Validación: OK."
	exit 0
fi

# 2. Preparar o directorio de empaquetado temporal
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/$NOME/content"
cp "$MANIFEST" "$TMP/$NOME/manifest.json"
cp content/abalar.js content/abalar.css "$TMP/$NOME/content/"

# 3. Empaquetar
mkdir -p "$DIST"
if [[ "$DESTINO" == "chrome" ]]; then
	OUT="$DIST/abalar-chrome-v${VER}.zip"
else
	OUT="$DIST/abalar-v${VER}.xpi"
fi
rm -f "$OUT"

if command -v zip >/dev/null 2>&1; then
	(cd "$TMP/$NOME" && zip -qr "$OLDPWD/$OUT" manifest.json content)
else
	(cd "$TMP/$NOME" && python3 -c "
import shutil, sys
shutil.make_archive(sys.argv[1].rsplit('.', 1)[0], 'zip', '.')
" "$OLDPWD/$OUT")
fi

echo "   Artefacto xerado: $OUT"
unzip -l "$OUT" | head -15
echo "== Feito =="
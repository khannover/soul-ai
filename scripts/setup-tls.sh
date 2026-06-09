#!/usr/bin/env bash
# Generate local TLS certs for Soul-AI (mic, speech, PWA need https:// or localhost).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="$ROOT/certs"
CERT_FILE="$CERT_DIR/soul-ai.pem"
KEY_FILE="$CERT_DIR/soul-ai-key.pem"
LEGACY_CERT="$CERT_DIR/souler.pem"
LEGACY_KEY="$CERT_DIR/souler-key.pem"
HTTPS_PORT="${SOUL_AI_HTTPS_PORT:-${SOULER_HTTPS_PORT:-8443}}"

mkdir -p "$CERT_DIR"

# Reuse legacy cert filenames from pre-rename installs
if [[ ! -f "$CERT_FILE" && -f "$LEGACY_CERT" && -f "$LEGACY_KEY" ]]; then
  cp "$LEGACY_CERT" "$CERT_FILE"
  cp "$LEGACY_KEY" "$KEY_FILE"
  echo "Reusing legacy TLS cert (copied souler.pem → soul-ai.pem)"
  exit 0
fi

# Extra hostnames/IPs: SOUL_AI_TLS_EXTRA="192.168.1.42 myphone.local"
EXTRA_HOSTS=()
if [[ -n "${SOUL_AI_TLS_EXTRA:-${SOULER_TLS_EXTRA:-}}" ]]; then
  read -r -a EXTRA_HOSTS <<< "${SOUL_AI_TLS_EXTRA:-${SOULER_TLS_EXTRA:-}}"
fi

WSL_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"

MKCERT_BIN=""
if command -v mkcert >/dev/null 2>&1; then
  MKCERT_BIN="mkcert"
elif [[ -x "$ROOT/scripts/bin/mkcert" ]]; then
  MKCERT_BIN="$ROOT/scripts/bin/mkcert"
fi

if [[ -n "$MKCERT_BIN" ]]; then
  echo "Using mkcert (browser-trusted local CA)…"
  "$MKCERT_BIN" -install 2>/dev/null || true
  HOSTS=(localhost 127.0.0.1 ::1 soul-ai.local)
  [[ -n "$WSL_IP" ]] && HOSTS+=("$WSL_IP")
  HOSTS+=("${EXTRA_HOSTS[@]}")
  "$MKCERT_BIN" -cert-file "$CERT_FILE" -key-file "$KEY_FILE" "${HOSTS[@]}"
else
  echo "mkcert not found — generating OpenSSL self-signed cert (browser will warn once)."
  echo "For trusted HTTPS + Service Worker on :8443:"
  echo "  Windows: choco install mkcert && mkcert -install"
  echo "  WSL:     see https://github.com/FiloSottile/mkcert — then npm run tls"
  echo "Or skip TLS for local dev: http://localhost:8088 (mic + SW work without cert)"
  OPENSSL_CFG="$(mktemp)"
  cat > "$OPENSSL_CFG" <<EOF
[req]
default_bits = 4096
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = san

[dn]
CN = soul-ai.local

[san]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = soul-ai.local
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
  idx=3
  if [[ -n "$WSL_IP" ]]; then
    echo "IP.$idx = $WSL_IP" >> "$OPENSSL_CFG"
    idx=$((idx + 1))
  fi
  for host in "${EXTRA_HOSTS[@]}"; do
    if [[ "$host" =~ ^[0-9.]+$ ]]; then
      echo "IP.$idx = $host" >> "$OPENSSL_CFG"
    else
      echo "DNS.$idx = $host" >> "$OPENSSL_CFG"
    fi
    idx=$((idx + 1))
  done
  openssl req -x509 -newkey rsa:4096 -sha256 -days 825 -nodes \
    -keyout "$KEY_FILE" -out "$CERT_FILE" -config "$OPENSSL_CFG"
  rm -f "$OPENSSL_CFG"
fi

chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

echo ""
echo "TLS ready:"
echo "  cert: $CERT_FILE"
echo "  key:  $KEY_FILE"
echo ""
echo "Start stack:  cd $ROOT && docker compose up -d --build"
echo "Dev (recommended):  http://localhost:8088   (mic, speech, SW — no cert)"
echo "HTTPS:              https://localhost:${HTTPS_PORT}  (needs mkcert for SW)"
[[ -n "$WSL_IP" ]] && echo "LAN / phone:        https://${WSL_IP}:${HTTPS_PORT}"
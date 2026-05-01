#!/usr/bin/env bash
# Первоначальное получение TLS-сертификата от Let's Encrypt.
# Запускать ОДИН РАЗ после первого деплоя docker-стека.
# После этого контейнер `certbot` сам обновляет сертификат каждые 12 часов.
#
# ТРЕБОВАНИЯ:
#   - DNS A-записи $APP_DOMAIN и $API_DOMAIN указывают на этот сервер
#   - Порт 80 СВОБОДЕН на хосте (Let's Encrypt HTTP-01 challenge всегда :80)
#   - Порт 443 свободен (для HTTPS трафика)
#   - .env.docker заполнен корректными доменами

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env.docker ]]; then
  echo "❌ .env.docker не найден"
  exit 1
fi

# shellcheck disable=SC1091
source .env.docker

if [[ -z "${APP_DOMAIN:-}" || -z "${API_DOMAIN:-}" || -z "${LE_EMAIL:-}" ]]; then
  echo "❌ APP_DOMAIN / API_DOMAIN / LE_EMAIL не заданы в .env.docker"
  exit 1
fi

CERT_NAME="xthing"
COMPOSE="docker compose --env-file .env.docker"

# 0) Sanity: порт 80 свободен на хосте? Let's Encrypt не примет другой порт.
HTTP_PORT="${HOST_HTTP_PORT:-80}"
if [[ "$HTTP_PORT" != "80" ]]; then
  echo "❌ HOST_HTTP_PORT=$HTTP_PORT, но Let's Encrypt HTTP-01 challenge"
  echo "   работает ТОЛЬКО через 80 порт. Освободите 80 и уберите HOST_HTTP_PORT"
  echo "   из .env.docker, либо используйте DNS-01 challenge (вручную)."
  exit 1
fi

if ss -tln 2>/dev/null | grep -qE ":80\s"; then
  if ! docker ps --format '{{.Names}}' | grep -q xthing-nginx; then
    echo "❌ Порт 80 занят, но не нашим nginx-ом. Освободите его:"
    echo "   sudo ss -tlnp | grep ':80 '"
    echo "   sudo systemctl stop apache2|nginx|caddy   (что нашли)"
    exit 1
  fi
fi

echo "==> Запрос сертификата для: $APP_DOMAIN, $API_DOMAIN  (email: $LE_EMAIL)"
echo

# 1) Временный self-signed cert чтобы nginx мог стартовать на 443
echo "==> Генерирую dummy-cert (чтобы nginx стартанул)…"
$COMPOSE run --rm --entrypoint sh certbot -c "
  set -e
  mkdir -p /etc/letsencrypt/live/${CERT_NAME}
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/${CERT_NAME}/privkey.pem \
    -out    /etc/letsencrypt/live/${CERT_NAME}/fullchain.pem \
    -subj   '/CN=localhost'
"

# 2) Поднять nginx и убедиться, что он реально слушает 80
echo "==> Поднимаю nginx…"
$COMPOSE up -d nginx
sleep 3

if ! $COMPOSE ps nginx | grep -q "Up\|running"; then
  echo "❌ nginx не запустился. Логи:"
  $COMPOSE logs nginx | tail -30
  exit 1
fi

# Проверим, что порт 80 реально отвечает (с этого же хоста)
if ! curl -sf --max-time 5 -o /dev/null "http://localhost/.well-known/acme-challenge/test" \
   && ! curl -s --max-time 5 -o /dev/null -w "%{http_code}" "http://localhost/" | grep -qE "^(200|301|404)$"; then
  echo "⚠ Локальный curl http://localhost/ не отвечает. Возможно проблема с binding."
fi

# 3) Удалить dummy
echo "==> Чищу dummy-cert…"
$COMPOSE run --rm --entrypoint sh certbot -c "
  rm -rf /etc/letsencrypt/live/${CERT_NAME} \
         /etc/letsencrypt/archive/${CERT_NAME} \
         /etc/letsencrypt/renewal/${CERT_NAME}.conf
"

# 4) Запросить настоящий cert через webroot challenge
#    --max-time у LE по умолчанию ~120с; ставим явный --debug-challenges если надо
echo "==> Запрашиваю настоящий сертификат у Let's Encrypt…"
echo "    (это занимает 5–30 сек; если зависает — DNS не резолвится или :80 не достижим извне)"
echo

if ! $COMPOSE run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --cert-name "$CERT_NAME" \
  -d "$APP_DOMAIN" -d "$API_DOMAIN" \
  --email "$LE_EMAIL" \
  --agree-tos --no-eff-email \
  --rsa-key-size 2048 \
  --non-interactive; then
  echo
  echo "❌ Certbot упал. Возможные причины:"
  echo "   1. DNS A-записи $APP_DOMAIN / $API_DOMAIN не указывают на этот сервер"
  echo "      Проверь:  dig +short $APP_DOMAIN   и   dig +short $API_DOMAIN"
  echo "      У провайдера сервера и в .env.docker должен быть один публичный IP."
  echo
  echo "   2. Порт 80 не доступен из интернета (firewall провайдера / cloud SG)"
  echo "      Проверь снаружи:  curl -v http://$APP_DOMAIN/"
  echo
  echo "   3. На порту 80 кто-то ещё, кроме нашего nginx:"
  echo "      sudo ss -tlnp | grep ':80 '"
  exit 1
fi

# 5) Reload nginx — подхватит новый сертификат
echo "==> Перезагружаю nginx…"
$COMPOSE exec nginx nginx -s reload

echo
echo "✓ Готово. Откройте:"
echo "    https://$APP_DOMAIN"
echo "    https://$API_DOMAIN/health"
echo
echo "Для авто-обновления (каждые 12ч):"
echo "    $COMPOSE up -d certbot"

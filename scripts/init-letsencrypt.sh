#!/usr/bin/env bash
# Первоначальное получение TLS-сертификата от Let's Encrypt.
# Запускать ОДИН РАЗ после первого деплоя docker-стека.
# После этого контейнер `certbot` сам обновляет сертификат каждые 12 часов.
#
# Использует certbot --standalone: certbot сам биндит порт 80 на время
# challenge'а. Это надёжнее, чем dummy-cert + nginx, потому что не зависит
# от шеринга named-volumes между one-shot и обычными контейнерами.
#
# ТРЕБОВАНИЯ:
#   - DNS A-записи $APP_DOMAIN и $API_DOMAIN указывают на этот сервер
#   - Порт 80 СВОБОДЕН (LE HTTP-01 challenge всегда :80)
#   - Порт 443 свободен (для последующего HTTPS трафика nginx-а)
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

# 0) Sanity: HOST_HTTP_PORT обязан быть 80
HTTP_PORT="${HOST_HTTP_PORT:-80}"
if [[ "$HTTP_PORT" != "80" ]]; then
  echo "❌ HOST_HTTP_PORT=$HTTP_PORT, но Let's Encrypt HTTP-01 challenge"
  echo "   работает только через порт 80. Уберите HOST_HTTP_PORT из .env.docker."
  exit 1
fi

# 1) Гасим nginx (если запущен) — освобождаем 80 для standalone certbot
echo "==> Останавливаю nginx (если запущен)…"
$COMPOSE stop nginx 2>/dev/null || true

# 2) Проверяем что порт 80 действительно свободен
if ss -tln 2>/dev/null | grep -qE ":80\s"; then
  echo "❌ Порт 80 занят чем-то посторонним. Освободите:"
  echo "   sudo ss -tlnp | grep ':80 '"
  echo "   sudo systemctl stop apache2|nginx|caddy   (что нашли)"
  exit 1
fi

echo "==> Запрос сертификата для: $APP_DOMAIN, $API_DOMAIN  (email: $LE_EMAIL)"
echo "    Standalone-режим: certbot сам слушает :80 на время challenge'а."
echo

# 3) Получаем настоящий сертификат через --standalone
#    -p 80:80 биндит хост-порт на контейнер
if ! $COMPOSE run --rm \
  -p 80:80 \
  --entrypoint certbot \
  certbot certonly --standalone \
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
  echo "      Должен вернуть IP этого сервера ($(curl -s ifconfig.me 2>/dev/null || echo '???'))"
  echo
  echo "   2. Порт 80 закрыт у провайдера / cloud security group"
  echo "      С другого хоста:   curl -v http://$APP_DOMAIN/"
  echo
  echo "   3. Достигнут лимит LE (5 неуспешных запросов в час, 50 успешных в неделю)"
  echo "      Подожди час либо переключись на staging:"
  echo "      добавь --staging в команду certbot выше"
  exit 1
fi

# 4) Поднимаем nginx — теперь сертификат на месте
echo
echo "==> Поднимаю nginx с настоящим сертификатом…"
$COMPOSE up -d nginx
sleep 2

if ! $COMPOSE ps nginx | grep -qE "running|Up"; then
  echo "❌ nginx не запустился. Логи:"
  $COMPOSE logs --tail=50 nginx
  exit 1
fi

# 5) Включаем certbot для авто-renew (renew работает через webroot, не standalone)
echo "==> Включаю certbot для авто-обновления (каждые 12ч)…"
$COMPOSE up -d certbot

echo
echo "✓ Готово. Откройте:"
echo "    https://$APP_DOMAIN"
echo "    https://$API_DOMAIN/health"

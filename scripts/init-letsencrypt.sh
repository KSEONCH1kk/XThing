#!/usr/bin/env bash
# Первоначальное получение TLS-сертификата от Let's Encrypt.
# Запускать ОДИН РАЗ после первого деплоя docker-стека.
# После этого контейнер `certbot` сам обновляет сертификат каждые 12 часов.
#
# Требования:
#   - DNS A-записи для $APP_DOMAIN и $API_DOMAIN указывают на этот VDS
#   - Порты 80 и 443 открыты в файрволе
#   - .env.docker заполнен

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env.docker ]]; then
  echo "❌ .env.docker не найден. Скопируйте .env.docker.example и заполните."
  exit 1
fi

# shellcheck disable=SC1091
source .env.docker

if [[ -z "${APP_DOMAIN:-}" || -z "${API_DOMAIN:-}" || -z "${LE_EMAIL:-}" ]]; then
  echo "❌ APP_DOMAIN / API_DOMAIN / LE_EMAIL не заданы в .env.docker"
  exit 1
fi

CERT_NAME="xthing"

echo "==> Запрос сертификата для: $APP_DOMAIN, $API_DOMAIN  (email: $LE_EMAIL)"
echo

# 1) Создаём временный self-signed cert чтобы nginx мог стартовать на 443.
#    (Без него nginx упадёт при попытке загрузить отсутствующий fullchain.)
echo "==> Генерирую временный dummy-cert (для запуска nginx)…"
docker compose run --rm --entrypoint sh certbot -c "
  set -e
  mkdir -p /etc/letsencrypt/live/${CERT_NAME}
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/${CERT_NAME}/privkey.pem \
    -out    /etc/letsencrypt/live/${CERT_NAME}/fullchain.pem \
    -subj   '/CN=localhost'
"

# 2) Поднимаем nginx с dummy-cert
echo "==> Поднимаю nginx…"
docker compose up -d nginx

# 3) Удаляем dummy
echo "==> Чищу dummy-cert…"
docker compose run --rm --entrypoint sh certbot -c "
  rm -rf /etc/letsencrypt/live/${CERT_NAME} \
         /etc/letsencrypt/archive/${CERT_NAME} \
         /etc/letsencrypt/renewal/${CERT_NAME}.conf
"

# 4) Запрашиваем настоящий cert через webroot challenge
echo "==> Запрашиваю настоящий сертификат у Let's Encrypt…"
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --cert-name "$CERT_NAME" \
  -d "$APP_DOMAIN" -d "$API_DOMAIN" \
  --email "$LE_EMAIL" \
  --agree-tos --no-eff-email \
  --rsa-key-size 2048

# 5) Reload nginx — подхватит новый сертификат
echo "==> Перезагружаю nginx…"
docker compose exec nginx nginx -s reload

echo
echo "✓ Готово. Откройте:"
echo "    https://$APP_DOMAIN  — клиент"
echo "    https://$API_DOMAIN/health  — backend"
echo
echo "Для авто-обновления запустите:"
echo "    docker compose up -d certbot"

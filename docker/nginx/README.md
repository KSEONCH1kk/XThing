# Nginx config

`default.conf` хардкодит `app.example.com` и `api.example.com`. Чтобы
быстро переехать на свой домен:

```bash
# Замените домены везде
sed -i \
  -e 's/app.example.com/app.your-domain.com/g' \
  -e 's/api.example.com/api.your-domain.com/g' \
  docker/nginx/conf.d/default.conf
```

После этого пересоздайте контейнер nginx:

```bash
docker compose up -d --force-recreate nginx
```

## Сертификаты

`init-letsencrypt.sh` (в `scripts/`) получает один certificate для двух
доменов через SAN с `--cert-name xthing` — поэтому в конфигах путь
`/etc/letsencrypt/live/xthing/fullchain.pem` (не `app.example.com/...`).

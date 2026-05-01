# Удобные shortcuts для production-деплоя через docker compose.
# Используется в /opt/xthing на VDS.

SHELL := /bin/bash

.PHONY: help up down restart build deploy logs ps cert backup admin

help:
	@echo "XThing — production targets:"
	@echo "  make up           — поднять весь стек"
	@echo "  make down         — остановить"
	@echo "  make restart      — перезапустить server и nginx"
	@echo "  make build        — пересобрать server и client образы"
	@echo "  make deploy       — git pull + build + republish client + restart server"
	@echo "  make logs         — лайв-логи всего стека"
	@echo "  make ps           — статус контейнеров"
	@echo "  make cert         — первоначальное получение TLS"
	@echo "  make backup       — pg_dump в /var/backups/xthing/"
	@echo "  make admin EMAIL=you@example.com  — назначить пользователя админом"

up:
	docker compose up -d postgres redis server
	docker compose up client_publisher
	docker compose up -d nginx certbot

down:
	docker compose down

restart:
	docker compose restart server
	docker compose exec nginx nginx -s reload

build:
	docker compose build server client_build

deploy:
	git pull --ff-only
	docker compose build server client_build
	docker compose up client_publisher
	docker compose up -d server
	docker compose exec nginx nginx -s reload
	@echo "✓ Deployed"

logs:
	docker compose logs -f --tail=200

ps:
	docker compose ps

cert:
	./scripts/init-letsencrypt.sh

backup:
	@mkdir -p /var/backups/xthing
	@DATE=$$(date +%Y%m%d-%H%M); \
	docker compose exec -T postgres pg_dump -U xthing xthing \
	  | gzip > /var/backups/xthing/xthing-$$DATE.sql.gz; \
	echo "Backup: /var/backups/xthing/xthing-$$DATE.sql.gz"
	@find /var/backups/xthing -name 'xthing-*.sql.gz' -mtime +14 -delete

admin:
	@if [ -z "$(EMAIL)" ]; then echo "Usage: make admin EMAIL=you@example.com"; exit 1; fi
	docker compose exec postgres psql -U xthing -d xthing \
	  -c "UPDATE users SET is_admin=TRUE WHERE email='$(EMAIL)';"

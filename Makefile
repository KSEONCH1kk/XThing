# Удобные shortcuts для production-деплоя через docker compose.
# Используется в /opt/xthing на VDS.

SHELL := /bin/bash

# Все compose-команды читают .env.docker для подстановки ${VAR} в compose.yml.
COMPOSE := docker compose --env-file .env.docker

.PHONY: help up down restart build deploy logs ps cert backup admin

help:
	@echo "XThing — production targets:"
	@echo "  make up           — поднять весь стек (server, nginx, опубликовать client)"
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
	$(COMPOSE) up -d postgres redis server
	$(COMPOSE) up client_publisher
	$(COMPOSE) up -d nginx certbot

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart server
	$(COMPOSE) exec nginx nginx -s reload

build:
	$(COMPOSE) build server client_publisher

deploy:
	git pull --ff-only
	$(COMPOSE) build server client_publisher
	$(COMPOSE) up client_publisher
	$(COMPOSE) up -d server
	$(COMPOSE) exec nginx nginx -s reload
	@echo "✓ Deployed"

logs:
	$(COMPOSE) logs -f --tail=200

ps:
	$(COMPOSE) ps

cert:
	./scripts/init-letsencrypt.sh

backup:
	@mkdir -p /var/backups/xthing
	@DATE=$$(date +%Y%m%d-%H%M); \
	$(COMPOSE) exec -T postgres pg_dump -U xthing xthing \
	  | gzip > /var/backups/xthing/xthing-$$DATE.sql.gz; \
	echo "Backup: /var/backups/xthing/xthing-$$DATE.sql.gz"
	@find /var/backups/xthing -name 'xthing-*.sql.gz' -mtime +14 -delete

admin:
	@if [ -z "$(EMAIL)" ]; then echo "Usage: make admin EMAIL=you@example.com"; exit 1; fi
	$(COMPOSE) exec postgres psql -U xthing -d xthing \
	  -c "UPDATE users SET is_admin=TRUE WHERE email='$(EMAIL)';"

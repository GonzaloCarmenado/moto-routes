# syntax=docker/dockerfile:1

# La etapa de build parte de la imagen oficial golang:1.25-trixie (Debian 13,
# igual que el resto del monorepo) en vez del paquete `apt` de Go de trixie:
# ese paquete solo llega a Go 1.24, insuficiente para las versiones de pgx/
# x/text que corrigen GO-2026-5004 y GO-2026-5970 (ver design.md, Open
# Questions). El binario resultante es estático: la etapa de runtime no
# necesita el toolchain de Go, solo el binario — se mantiene debian:trixie-slim
# para paridad operativa con el resto del monorepo (ver ADR-034).
# El runtime ejecuta el binario como usuario no-root (appuser, ver
# hardening-despliegue-servidor): el servicio no necesita privilegios de
# superusuario para escuchar en :8080 ni para hablar con Postgres por loopback.

# Build de apps/web (panel de reporting, dashboard-reporting) — contexto
# adicional de BuildKit apuntando solo a apps/web (docker-compose.yml/.prod.yml,
# additional_contexts), no al monorepo entero: apps/web no tiene dependencias
# de workspace (su package.json no referencia ningún paquete `workspace:*`),
# así que se resuelve como proyecto standalone con npm, sin necesitar el
# pnpm-lock.yaml compartido ni el resto de apps/mobile en este contexto.
FROM node:22-trixie AS web-build
WORKDIR /web
COPY --from=web package.json ./
RUN npm install
COPY --from=web . .
RUN npm run build

FROM golang:1.25-trixie AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
# Sobrescribe el placeholder committeado (ver internal/webui/dist/) con el
# build real antes de compilar — //go:embed exige que el directorio exista en
# tiempo de compilación (ver dashboard-reporting, tasks.md 4.3).
COPY --from=web-build /web/dist ./internal/webui/dist
RUN CGO_ENABLED=0 go build -o /app/bin/api ./cmd/api

FROM debian:trixie-slim AS runtime
# ca-certificates: sin esto, cualquier llamada HTTPS saliente (Resend, desde
# confirmacion-email-usuarios) falla con "certificate signed by unknown
# authority" — debian:trixie-slim no la trae por defecto. No hacía falta
# hasta ahora porque la única dependencia externa era Postgres (sin TLS en
# este despliegue). Detectado verificando de verdad el envío de email, no en
# revisión de código.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Usuario no-root para el proceso de la API: el contenedor corre con
# network_mode: host y escucha en :8080 (>1024), así que ningún privilegio
# de root es necesario. Un compromiso del proceso no otorga control root
# del contenedor.
RUN groupadd --system appuser && useradd --system --gid appuser --no-create-home appuser

WORKDIR /app
COPY --from=build /app/bin/api ./api

# El binario y el directorio de trabajo deben ser legibles/ejecutables por
# appuser. Sin volúmenes de escritura en el contenedor (Postgres es externo),
# appuser solo necesita lectura/ejecución.
RUN chown -R appuser:appuser /app

USER appuser
EXPOSE 8080
ENTRYPOINT ["./api"]
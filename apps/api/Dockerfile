# syntax=docker/dockerfile:1

# La etapa de build parte de la imagen oficial golang:1.25-trixie (Debian 13,
# igual que el resto del monorepo) en vez del paquete `apt` de Go de trixie:
# ese paquete solo llega a Go 1.24, insuficiente para las versiones de pgx/
# x/text que corrigen GO-2026-5004 y GO-2026-5970 (ver design.md, Open
# Questions). El binario resultante es estático: la etapa de runtime no
# necesita el toolchain de Go, solo el binario — se mantiene debian:trixie-slim
# para paridad operativa con el resto del monorepo (ver ADR-034).

FROM golang:1.25-trixie AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 go build -o /app/bin/api ./cmd/api

FROM debian:trixie-slim AS runtime
WORKDIR /app
COPY --from=build /app/bin/api ./api
EXPOSE 8080
ENTRYPOINT ["./api"]

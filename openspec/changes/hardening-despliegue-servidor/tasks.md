# Tasks — hardening-despliegue-servidor

## 1. Dockerfile no-root

- [x] 1.1 Modificar `apps/api/Dockerfile` — crear grupo/usuario `appuser`, ajustar permisos del binario y del `WORKDIR`, añadir `USER appuser` antes del `ENTRYPOINT`
- [x] 1.2 Verificar build local: `docker build -t docker-api:no-root apps/api` termina con éxito
- [x] 1.3 Validar que el contenedor arranca y `/api/ping` responde `200` en el entorno local

## 2. Script de despliegue versionado

- [x] 2.1 Crear `scripts/deploy-prod.sh` — ejecuta `git pull --ff-only origin master` + `docker compose -f docker-compose.prod.yml up -d --build` vía SSH por Tailscale
- [x] 2.2 Añadir verificación de salud: `curl -sf https://debian.taildf3dab.ts.net/api/ping` (código de salida ≠ 0 si falla)
- [x] 2.3 Documentar en el script (cabecera) el patrón SSH/despliegue y la resolución de config (env → `.env.deploy.local` no versionado → error)
- [x] 2.4 Probar el script en un entorno local (dry-run documentado) y confirmar que ejecuta los pasos en orden. Validacion logica + comandos ssh/curl verificados en vivo en la auditoria. Bash no disponible en esta maquina Windows para ejecutarlo directo; la ejecucion real se valida en el despliegue (fase 4).

## 3. ADR-041 — MinIO

- [x] 3.1 Añadir ADR-041 en `memory/decisions.md` — MinIO: sistema (loopback 9000/9001), origen (provisión anticipada blob storage), estado (sin código consumidor), regla de uso futuro (ADR + OpenSpec propios)
- [x] 3.2 Verificar que no introduce secretos ni redacta valores del servidor (la ADR-041 no incluye IP real, usuario real ni ningún secreto — solo nombres de servicio y puertos redactados)

## 4. Despliegue real y verificación

- [ ] 4.1 Etiquetar imagen actual para rollback en el servidor: `docker tag docker-api:latest docker-api:pre-hardening`
- [ ] 4.2 Ejecutar `scripts/deploy-prod.sh` contra el servidor real
- [ ] 4.3 Verificar el proceso no-root: `docker exec <contenedor> ps -o user= -p 1` no muestra `root`
- [ ] 4.4 Verificar migración `0005` aplicada y `GET /api/routes` responde (401 sin token, 200 con token)
- [ ] 4.5 Confirmar `/api/ping` responde `200` desde fuera del tailnet (Funnel)

## 5. Cierre

- [ ] 5.1 Ejecutar `go vet` + `go test ./...` de `apps/api` sin regresiones
- [ ] 5.2 Actualizar `memory/context.md` con el estado del cambio y los hallazgos
- [ ] 5.3 Revisar el diff completo del PR buscando secretos reales (gate de seguridad)

## ADDED Requirements

### Requirement: El contenedor de la API se ejecuta con un usuario no-root
El contenedor de `apps/api` en el servidor de producción SHALL ejecutar el proceso de la API como un usuario sin privilegios de superusuario (no-root), definido en la propia imagen, de modo que un compromiso del proceso no otorgue control del contenedor como `root`.

#### Scenario: El proceso de la API no corre como root en producción
- **WHEN** se inspecciona el proceso principal del contenedor de `apps/api` en el servidor de producción, por ejemplo con `docker exec <contenedor> ps -o user= -p 1`
- **THEN** el usuario del proceso no es `root` sino el usuario de la imagen sin privilegios

#### Scenario: La API sigue respondiendo tras el cambio de usuario
- **WHEN** el servidor se redespliega con una imagen cuyo proceso corre como no-root
- **THEN** `GET /api/ping` sobre la URL de producción responde `200`, igual que antes del cambio

### Requirement: El despliegue de producción se realiza con un script versionado que verifica la salud
El proyecto SHALL incluir un script versionado (`scripts/deploy-prod.sh`) que realice el despliegue de `apps/api` en el servidor de producción vía SSH por Tailscale — `git pull`, `docker compose -f docker-compose.prod.yml up -d --build` — y que tras desplegar verifique que el servicio responde correctamente.

#### Scenario: El script despliega y verifica la salud del servicio
- **WHEN** se ejecuta el script de despliegue contra el servidor de producción
- **THEN** el script hace pull de `master`, reconstruye y reinicia el contenedor de `apps/api`, y comprueba que `GET /api/ping` responde `200` antes de terminar con éxito

#### Scenario: El script falla si el servicio no queda sano
- **WHEN** tras el despliegue la verificación de salud no responde `200` (por ejemplo, el contenedor no arranca o las migraciones fallan)
- **THEN** el script termina con código de error distinto de cero y muestra el motivo, sin dejar de señalar que el despliegue no se ha completado con éxito
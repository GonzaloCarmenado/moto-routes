# server-deployment Specification

## Purpose

Ejecutar el servicio `apps/api` en el servidor real de producción (Debian 13, alcanzable solo vía Tailscale), conectado al PostgreSQL nativo ya existente en esa máquina, sin exponerlo más allá de la red privada de Tailscale.

## Requirements

### Requirement: La API solo es alcanzable a través de la red Tailscale del servidor
El servicio `apps/api` desplegado SHALL escuchar únicamente en la interfaz de red de Tailscale del servidor, no en la LAN doméstica ni en ninguna interfaz pública.

#### Scenario: La API responde a través de la IP de Tailscale
- **WHEN** un cliente dentro del mismo tailnet hace `GET` al endpoint de prueba usando la IP o el nombre Tailscale del servidor
- **THEN** la API responde con éxito, igual que en el entorno de desarrollo local

#### Scenario: La API no escucha en la LAN doméstica del servidor
- **WHEN** se inspecciona en qué interfaz(es) escucha el proceso de la API en el servidor (por ejemplo con `ss -tlnp`)
- **THEN** el puerto de la API solo aparece asociado a la IP de Tailscale del servidor, nunca a `0.0.0.0` ni a la IP de la LAN doméstica

### Requirement: La API se conecta al PostgreSQL nativo existente sin alterar su configuración
El despliegue SHALL conectar `apps/api` a la instancia de PostgreSQL nativa ya presente en el servidor (no una nueva instancia en Docker), sin modificar `pg_hba.conf` ni `postgresql.conf`.

#### Scenario: Conexión real contra la base de datos ya existente
- **WHEN** el endpoint de prueba se invoca tras el despliegue
- **THEN** responde con un dato leído de verdad de la base de datos `appdb` ya existente en el servidor, sin que se haya modificado ninguna regla de `pg_hba.conf` respecto a antes del despliegue

#### Scenario: La configuración de PostgreSQL no cambia
- **WHEN** se compara `pg_hba.conf` y `postgresql.conf` del servidor antes y después de este despliegue
- **THEN** ambos ficheros son idénticos a como estaban antes de empezar

### Requirement: El contenedor de la API se recupera solo tras un reinicio o una caída
El contenedor de `apps/api` en el servidor SHALL configurarse para reiniciarse automáticamente si el proceso termina o si el servidor se reinicia, sin intervención manual.

#### Scenario: El contenedor vuelve a arrancar tras reiniciar el servicio Docker
- **WHEN** el servicio Docker del servidor se reinicia (o el servidor entero se reinicia)
- **THEN** el contenedor de `apps/api` vuelve a estar en ejecución sin que nadie lo arranque a mano

### Requirement: Las credenciales del servidor no viven en el repositorio
La contraseña real de conexión a PostgreSQL en el servidor SHALL vivir únicamente en un fichero de entorno local al propio servidor, nunca en un fichero versionado del repositorio.

#### Scenario: No hay credenciales del servidor en git
- **WHEN** se inspecciona el repositorio (código, configuración de despliegue versionada)
- **THEN** ningún fichero rastreado por git contiene la contraseña real usada en el servidor; el valor solo existe en un fichero de entorno local a la máquina, fuera de control de versiones

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

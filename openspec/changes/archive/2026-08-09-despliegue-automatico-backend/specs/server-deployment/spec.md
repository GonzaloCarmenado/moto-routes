## ADDED Requirements

### Requirement: El despliegue de producción puede dispararse automáticamente desde CI al publicar una release
El proyecto SHALL poder desplegar `apps/api` en el servidor de producción de forma automática desde GitHub Actions, disparado por el mismo evento que ya publica una release (tag `v*`), sin requerir que nadie lo ejecute a mano por SSH.

#### Scenario: Publicar un tag de versión dispara el despliegue automático (verificación manual)
- **WHEN** se empuja un tag `v*` al repositorio
- **THEN** se inicia una ejecución del job de despliegue en GitHub Actions, sin ninguna acción manual adicional
- **Verificación manual**: no automatizable en Vitest/Cypress (es un flujo de GitHub Actions) — se confirma disparando un tag real y observando la ejecución en la pestaña Actions del repositorio.

#### Scenario: El despliegue automático ejecuta un script versionado, no lógica embebida en el workflow
- **WHEN** el job de despliegue automático se ejecuta
- **THEN** ejecuta `scripts/deploy-local.sh` (el mismo comportamiento — pull, build, verificación de salud — que `scripts/deploy-prod.sh` ya documenta para el despliegue manual, adaptado para correr ya dentro del servidor en vez de hacer SSH saliente)
- **Verificación manual**: confirmado revisando que el workflow no reimplementa `git pull`/`docker compose`/verificación de salud en el propio YAML, sino que se apoya en el script versionado ejecutado como shell de login del usuario de despliegue.

### Requirement: Ejecutar el despliegue automático exige aprobación humana explícita
Ninguna ejecución del job de despliegue automático SHALL empezar a interactuar con el servidor de producción sin que una persona autorizada la apruebe explícitamente primero — independientemente de quién haya disparado el tag que la originó.

#### Scenario: Un colaborador con permiso de escritura dispara un tag, pero el despliegue queda pendiente de aprobación (verificación manual)
- **WHEN** cualquier persona con permiso de escritura en el repositorio empuja un tag `v*`
- **THEN** el job de despliegue queda en estado "esperando aprobación" y no ejecuta ningún paso contra el servidor real hasta que la persona autorizada lo apruebe explícitamente
- **Verificación manual**: se confirma con un tag de prueba real, comprobando en la UI de GitHub Actions que el job queda pausado y que ningún log del script de despliegue aparece antes de aprobar.

#### Scenario: Tras aprobar, el despliegue se ejecuta con normalidad
- **WHEN** la persona autorizada aprueba la ejecución pendiente
- **THEN** el job continúa y ejecuta `scripts/deploy-prod.sh` contra el servidor real, con el mismo resultado que una ejecución manual equivalente
- **Verificación manual**: confirmado con una aprobación real durante la verificación de este cambio.

### Requirement: Las credenciales del despliegue automático están acotadas al mínimo necesario
Las credenciales de red y de acceso al servidor usadas por el despliegue automático SHALL estar restringidas de forma que, incluso si se filtraran, no permitan más que disparar el propio script de despliegue — nunca una sesión de shell interactiva libre ni acceso a otra parte de la red del servidor.

#### Scenario: La sesión del usuario de despliegue no permite abrir una shell interactiva (verificación manual)
- **WHEN** alguien se conecta al servidor como el usuario dedicado al despliegue automático (`ci-deploy`), sin importar qué comando pida el cliente SSH
- **THEN** el servidor ejecuta únicamente `scripts/deploy-local.sh` — la shell de login de ese usuario es el propio script, no un intérprete de comandos, así que cualquier comando pedido por el cliente se ignora sin efecto y nunca se obtiene una shell interactiva
- **Verificación manual**: confirmado conectando como `ci-deploy` desde una máquina de pruebas (`ssh ci-deploy@<host> whoami`, intento de shell interactiva) y comprobando que solo corre el script, nunca un shell libre.

#### Scenario: El acceso de red del runner de CI está limitado al servidor de producción
- **WHEN** el runner de GitHub Actions se une a la red Tailscale para el despliegue
- **THEN** solo puede alcanzar el servidor de producción por el puerto SSH — no el resto de dispositivos de la tailnet
- **Verificación manual**: confirmado revisando la política ACL de Tailscale aplicada al tag dedicado de este runner.

#### Scenario: Las credenciales nunca aparecen en el repositorio ni en los logs
- **WHEN** se inspecciona el repositorio (código, workflow versionado) y los logs de una ejecución del job de despliegue
- **THEN** ni la clave SSH privada ni las credenciales del cliente Tailscale aparecen en texto plano en ningún sitio — ambas viven como secrets del Environment de GitHub, nunca en un fichero versionado

## Purpose

Define la postura de seguridad propia de `apps/api` — cómo se protegen las credenciales, los secretos y el árbol de dependencias del servicio — como apartado explícito, no como buenas prácticas implícitas dispersas por el código.

## ADDED Requirements

### Requirement: Las contraseñas nunca se almacenan en texto plano
La API SHALL almacenar únicamente una forma irreversible de la contraseña de cada usuario, nunca la contraseña original.

#### Scenario: La contraseña almacenada no coincide con la enviada
- **WHEN** se inspecciona el valor guardado para una cuenta tras un registro
- **THEN** el valor almacenado no es igual al texto de la contraseña enviada en el registro, ni permite recuperarla

### Requirement: Los secretos de la API se leen de variables de entorno
Ningún secreto usado por `apps/api` (clave de firma de tokens, credenciales de base de datos, o cualquier otro secreto futuro) SHALL estar presente en texto plano en ningún fichero versionado del repositorio.

#### Scenario: No hay secretos hardcodeados en el código fuente
- **WHEN** se inspeccionan los ficheros versionados de `apps/api` (código fuente, ficheros de configuración, `Dockerfile`)
- **THEN** ningún fichero contiene un secreto real; los valores se referencian como variables de entorno

### Requirement: Los intentos de login fallidos están acotados
La API SHALL limitar el número de intentos de login fallidos consecutivos permitidos para una misma cuenta o dirección de origen en una ventana de tiempo, para mitigar ataques de fuerza bruta.

#### Scenario: Login bloqueado tras superar el límite de intentos fallidos
- **WHEN** un cliente envía más intentos de login fallidos consecutivos que el límite configurado, dentro de la ventana de tiempo definida
- **THEN** la API rechaza los intentos adicionales aunque las credenciales enviadas a partir de ese momento sean correctas, hasta que la ventana expire

### Requirement: Las respuestas de error no filtran información interna
Las respuestas de error de la API SHALL describir el problema sin incluir detalles internos de implementación (trazas de pila, rutas de fichero del servidor, consultas SQL).

#### Scenario: Un error interno no expone detalles de implementación
- **WHEN** se produce un error no controlado al procesar una petición
- **THEN** la respuesta de error no incluye traza de pila, ruta de fichero del servidor ni fragmentos de consulta SQL

### Requirement: La auditoría de vulnerabilidades del árbol de dependencias bloquea el commit
El pre-commit SHALL ejecutar una auditoría de vulnerabilidades conocidas sobre el árbol de dependencias de `apps/api`, bloqueando el commit ante cualquier vulnerabilidad real sin justificar explícitamente — mismo criterio ya aplicado a pnpm y Cargo en `security-audit`.

#### Scenario: El commit se bloquea si aparece una vulnerabilidad de dependencias no justificada
- **WHEN** la auditoría de dependencias de `apps/api` reporta al menos una vulnerabilidad real cuyo identificador no está en la lista de excepciones documentadas del hook
- **THEN** el hook de pre-commit termina con código de salida distinto de cero y el commit no se completa

#### Scenario: El commit no se bloquea por una vulnerabilidad explícitamente ignorada y justificada
- **WHEN** la auditoría de dependencias solo reporta vulnerabilidades cuyo identificador está en la lista de excepciones documentadas del hook, con justificación
- **THEN** el hook de pre-commit termina con código de salida cero y el commit se completa

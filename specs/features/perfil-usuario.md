# Feature: Perfil de Usuario

## Descripción
Primera versión de la pantalla de Perfil, hoy un placeholder sin vista asociada en `<nav-bar>` (ver `botonera-navegacion.md` AC-008 y `design-system.md` §8, "Navegación Inferior: Pendiente"). Permite al motorista personalizar su avatar y nombre, configurar la marca y modelo de su vehículo (moto o coche) consultando una API pública externa, y visualizar estadísticas agregadas de todas sus rutas grabadas. Es la primera vez que la app consume una API pública externa, por lo que esta feature también sienta las bases (cliente HTTP compartido, CSP) para futuras integraciones.

## Criterios de Aceptación

### Bloque 1 — Foto y nombre de perfil
- [ ] AC-001: La pantalla de Perfil muestra, en su parte superior, una foto de perfil circular (recorte visual `border-radius: 50%` + `object-fit: cover`) y, debajo, el nombre del usuario.
- [ ] AC-002: Si no se ha configurado ningún avatar todavía, se muestra un icono/silueta de marcador de posición en el círculo, nunca un hueco vacío ni un error.
- [ ] AC-003: Si no se ha configurado ningún nombre todavía, se muestra un texto de marcador de posición (p. ej. "Motorista sin nombre") en vez de un espacio vacío.
- [ ] AC-004: Existe un control "Editar" accesible desde la pantalla de Perfil que abre un modal único "Editar perfil" combinando la edición de foto y nombre.
- [ ] AC-005: El modal "Editar perfil" muestra una previsualización en vivo de cómo quedarán avatar y nombre juntos (mismo layout que la pantalla de Perfil, no un formulario suelto), actualizada en tiempo real mientras el usuario edita, antes de guardar.
- [ ] AC-006: Dentro del modal, un control "Cambiar foto" despliega el mismo patrón Cámara/Galería ya usado por `<photo-capture>` (`<input type="file" accept="image/*">`, con `capture="environment"` para la opción Cámara).
- [ ] AC-007: Al elegir una nueva foto, la previsualización circular del modal se actualiza inmediatamente con la imagen elegida (recorte solo visual por CSS; sin recorte real de la imagen en esta v1).
- [ ] AC-008: El campo de nombre tiene un límite de 100 caracteres (mismo límite que el nombre de ruta, ver AC-009 de `mejoras-guardado-rutas.md`); el usuario no puede escribir más allá de ese límite.
- [ ] AC-009: Al pulsar "Guardar" en el modal, la foto (si se cambió) y el nombre (recortado de espacios en los extremos) se persisten juntos en la base de datos local, el modal se cierra y la pantalla de Perfil se actualiza con los nuevos datos.
- [ ] AC-010: Al pulsar "Guardar" con el campo de nombre vacío o solo espacios en blanco, se conserva el nombre previamente guardado (o el marcador de posición de AC-003 si nunca hubo nombre) — nunca se persiste una cadena vacía como nombre.
- [ ] AC-011: Al pulsar "Cancelar" o cerrar el modal sin guardar, ningún cambio (foto ni nombre) se persiste; la pantalla de Perfil sigue mostrando los datos previos.
- [ ] AC-012: Si falla la persistencia al guardar (p. ej. error de BBDD), se muestra un toast de error (reutilizando el módulo compartido `showToast`) y el modal permanece abierto con los datos introducidos, para poder reintentar sin perderlos.
- [ ] AC-013: La foto de perfil se guarda en el sistema de archivos local reutilizando el mismo servicio que las fotos de ruta (`savePhotoFile`/`getPhotoUrl` de `photo-storage.service.ts`); nunca se sube a ningún servidor externo.

### Bloque 2 — Vehículo del perfil (marca y modelo) + integración con API pública NHTSA vPIC
- [ ] AC-014: La pantalla de Perfil muestra una sección "Mi vehículo" con el tipo, marca y modelo actualmente guardados, leídos directamente de la base de datos local (sin consultar ninguna API).
- [ ] AC-015: Si no hay ningún vehículo configurado todavía, la sección muestra un estado vacío (p. ej. "Sin vehículo configurado") con una acción para añadirlo.
- [ ] AC-016: Existe un control "Editar vehículo" independiente del modal "Editar perfil" de avatar/nombre, que abre su propio flujo de edición.
- [ ] AC-017: Al editar el vehículo se muestra siempre visible un selector de tipo con dos opciones, "Moto" y "Coche" — tanto la primera vez que se configura como en cualquier edición posterior, nunca se oculta una vez ya hay un vehículo guardado.
- [ ] AC-018: Al elegir o cambiar el tipo, se consulta la API pública NHTSA vPIC (`GET /vehicles/GetMakesForVehicleType/{motorcycle|car}?format=json`) para poblar el select de marca filtrado por ese tipo. El select de modelo permanece deshabilitado y vacío hasta que se elija una marca.
- [ ] AC-019: Al elegir una marca, se consulta `GET /vehicles/GetModelsForMake/{make}?format=json` (filtrado por el tipo de vehículo elegido) para poblar el select de modelo.
- [ ] AC-020: Mientras se está consultando la API (marcas o modelos), el select correspondiente muestra un estado de carga visual acorde al sistema de diseño, sin bloquear el resto de la pantalla.
- [ ] AC-021: Al pulsar "Guardar" con tipo, marca y modelo elegidos, esos tres valores se persisten juntos como el vehículo del perfil, **reemplazando** cualquier vehículo guardado previamente — nunca se acumula más de un vehículo a la vez.
- [ ] AC-022: Si el usuario cambia de tipo a mitad de edición (p. ej. de "Moto" a "Coche"), cualquier marca/modelo ya elegido para el tipo anterior se descarta y los selects de marca/modelo vuelven a su estado inicial (marca vacía, modelo deshabilitado).
- [ ] AC-023: Al pulsar "Cancelar" o cerrar el flujo de edición del vehículo sin guardar, ningún cambio se persiste; la pantalla de Perfil sigue mostrando el vehículo previamente guardado (o el estado vacío de AC-015).
- [ ] AC-024: La API externa **nunca** se consulta al cargar o visualizar la pantalla de Perfil en su estado normal — solo se consulta cuando el usuario entra explícitamente en el flujo de edición del vehículo (AC-018/AC-019). La visualización normal (AC-014) siempre lee de la base de datos local.
- [ ] AC-025: Si la API no está disponible al intentar cargar marcas o modelos durante la edición (sin conexión, timeout, error de red o respuesta no-JSON), se muestra un mensaje de error acorde al sistema de diseño (nunca una pantalla rota ni un error sin manejar en consola), y el usuario puede reintentar sin salir del flujo de edición.
- [ ] AC-026: Si la consulta de marcas o modelos falla pero el usuario ya tenía un vehículo guardado, ese vehículo guardado no se pierde ni se borra por el fallo — solo se ve afectada la posibilidad de cambiarlo hasta que la API vuelva a estar disponible.
- [ ] AC-027: El cliente HTTP usado para consultar la API tiene un timeout explícito (nunca queda esperando indefinidamente) y distingue en su manejo de errores entre error de red, timeout y respuesta no-JSON.

### Bloque 3 — Estadísticas del usuario
- [ ] AC-028: La pantalla de Perfil muestra una sección de estadísticas agregadas de todas las rutas guardadas del usuario, reutilizando el patrón visual `.stat-tile`/`.stat-grid` ya usado en el cockpit.
- [ ] AC-029: Las estadísticas mostradas incluyen, como mínimo: kilómetros totales recorridos, tiempo total en moto, ruta más larga (por distancia), número total de rutas, y velocidad media histórica.
- [ ] AC-030: Las estadísticas se calculan únicamente a partir de rutas con `status = 'completed'` — las rutas `active` (en curso) y `archived` quedan excluidas del cálculo.
- [ ] AC-031: Si el usuario no tiene ninguna ruta completada guardada, la sección de estadísticas muestra un estado vacío coherente con el resto de la app (p. ej. "Todavía no hay rutas completadas"), sin errores ni valores `NaN`/`Infinity` visibles.
- [ ] AC-032: "Ruta más larga" muestra el nombre de la ruta con mayor `totalDistance` entre las completadas (o el nombre por defecto derivado de fecha/hora si no tiene nombre propio, mismo fallback que AC-007 de `mejoras-guardado-rutas.md`) junto con su distancia.
- [ ] AC-033: "Velocidad media histórica" se calcula como la media aritmética del campo `avgSpeed` de cada ruta completada (no como distancia total entre tiempo total), reutilizando el dato ya persistido por ruta.
- [ ] AC-034: Las clases `.stat-tile`/`.stat-grid` (hoy definidas únicamente en `cockpit.element.css`) se promueven a `src/shared/` como parte de esta feature, al ganar un segundo consumidor real (Perfil) — siguiendo la regla ya documentada en `frontend-conventions.md` §4 y `design-system.md` §10.10, sin cambiar su apariencia visual en el cockpit.

### Navegación e integración con `<nav-bar>`
- [ ] AC-035: El botón "Perfil" de `<nav-bar>` (hoy sin acción, ver AC-008 de `botonera-navegacion.md`) navega a la nueva vista de Perfil al pulsarlo, dejando de ser un placeholder.
- [ ] AC-036: Estando en la vista de Perfil, el botón "Perfil" de la nav-bar se marca como activo (mismo tratamiento visual `--amber` que ya reciben "Grabar"/"Rutas" al estar activos) y los otros dos botones quedan inactivos.
- [ ] AC-037: Todos los controles interactivos nuevos (avatar, botón "Editar" de perfil, campo de nombre, botón "Cambiar foto", botón "Editar vehículo", selector de tipo, selects de marca/modelo, botones "Guardar"/"Cancelar" de ambos flujos de edición) llevan un atributo `data-cy` único y semántico siguiendo la convención `<contexto>-<tipo>-<accion>` del proyecto, añadido en el propio `.element.ts` al crearlos.
- [ ] AC-038: Todos los controles interactivos de la pantalla de Perfil (avatar tocable, botones de edición, selects, botones "Guardar"/"Cancelar") cumplen la hitbox mínima de 56×56px.

## Comportamiento Esperado

### Escenario: Ver la pantalla de Perfil ya configurada (Happy Path)
- **Dado** que el usuario tiene avatar, nombre, vehículo y varias rutas completadas guardadas
- **Cuando** pulsa "Perfil" en la barra de navegación inferior
- **Entonces** ve su avatar y nombre en la parte superior, su vehículo (tipo, marca, modelo) en "Mi vehículo", y sus estadísticas agregadas, todo leído directamente de la base de datos local sin ninguna llamada de red

### Escenario: Editar avatar y nombre juntos
- **Dado** que el usuario está en la pantalla de Perfil y pulsa "Editar"
- **Cuando** cambia la foto desde "Cambiar foto" (opción Galería) y escribe un nuevo nombre, viendo la previsualización combinada actualizarse, y pulsa "Guardar"
- **Entonces** la nueva foto y el nuevo nombre se persisten juntos, el modal se cierra y la pantalla de Perfil muestra los datos actualizados

### Escenario: Guardar el modal de perfil con el nombre vacío
- **Dado** que el usuario ya tenía el nombre "Marc" guardado y abre el modal "Editar perfil"
- **Cuando** borra todo el contenido del campo de nombre y pulsa "Guardar"
- **Entonces** el nombre persistido sigue siendo "Marc" (no se sobreescribe con una cadena vacía)

### Escenario: Cancelar la edición de perfil sin guardar
- **Dado** que el usuario abre el modal "Editar perfil" y cambia la foto y el nombre
- **Cuando** pulsa "Cancelar" en lugar de "Guardar"
- **Entonces** ningún cambio se persiste y la pantalla de Perfil sigue mostrando los datos previos

### Escenario: Configurar el vehículo por primera vez (Happy Path)
- **Dado** que el usuario no tiene ningún vehículo configurado y pulsa "Editar vehículo"
- **Cuando** selecciona el tipo "Moto", espera a que se cargue el select de marcas, elige "Honda", espera a que se cargue el select de modelos, elige "CB500X" y pulsa "Guardar"
- **Entonces** el vehículo se persiste como tipo Moto, marca Honda, modelo CB500X, y la sección "Mi vehículo" lo muestra sin volver a consultar la API

### Escenario: Cambiar el tipo de vehículo de Moto a Coche a mitad de edición
- **Dado** que el usuario está editando el vehículo y ya eligió tipo "Moto" y marca "Yamaha"
- **Cuando** cambia el selector de tipo a "Coche"
- **Entonces** el select de marca se recarga con las marcas de coche (vía la API) y el select de modelo vuelve a estar vacío/deshabilitado, sin conservar "Yamaha"

### Escenario: Editar vehículo sin conexión a internet
- **Dado** que el usuario pulsa "Editar vehículo" y el dispositivo no tiene conexión a internet
- **Cuando** elige un tipo y la app intenta cargar el select de marcas
- **Entonces** se muestra un mensaje de error acorde al sistema de diseño, con posibilidad de reintentar, y si el usuario ya tenía un vehículo guardado antes, este sigue intacto en "Mi vehículo" tras cerrar el flujo de edición sin guardar

### Escenario: La pantalla de Perfil no consulta la API al abrirse normalmente
- **Dado** que el usuario ya tiene un vehículo guardado
- **Cuando** navega a la pantalla de Perfil desde la nav-bar (sin entrar en "Editar vehículo")
- **Entonces** no se realiza ninguna petición de red a la API de vPIC; el tipo/marca/modelo mostrados provienen únicamente de la base de datos local

### Escenario: Ver estadísticas con rutas completadas (Happy Path)
- **Dado** que el usuario tiene 3 rutas con `status = 'completed'` (distancias 20 km, 45 km y 120 km) y 1 ruta con `status = 'active'` en curso
- **Cuando** abre la pantalla de Perfil
- **Entonces** las estadísticas muestran 185 km totales, el número total de rutas es 3, la ruta más larga es la de 120 km, y la ruta activa no influye en ningún cálculo

### Escenario: Ver estadísticas sin ninguna ruta completada
- **Dado** que el usuario no tiene ninguna ruta con `status = 'completed'` guardada
- **Cuando** abre la pantalla de Perfil
- **Entonces** la sección de estadísticas muestra un estado vacío explicativo, sin errores ni valores `NaN`/`Infinity`

### Escenario: Navegar a Perfil desde la nav-bar
- **Dado** que la app está mostrando cualquier otra vista (Cockpit o Rutas)
- **Cuando** el usuario pulsa el botón "Perfil" de la barra de navegación inferior
- **Entonces** la app muestra la vista de Perfil y el botón "Perfil" se marca como activo (`--amber`), quedando los otros botones inactivos

## Constraints
- El perfil es **singleton**: no existe sistema de autenticación ni multi-usuario en el proyecto (verificado en todo el código y en `memory/`), por lo que solo existe una fila de perfil local, nunca una lista de perfiles entre los que elegir.
- El vehículo del perfil es **único**: nunca se guardan simultáneamente una moto y un coche — cambiar de tipo reemplaza el vehículo guardado (AC-021/AC-022).
- La API externa (NHTSA vPIC) solo se consulta durante la edición del vehículo, nunca en la carga/visualización normal de la pantalla de Perfil (AC-024) — regla de negocio no negociable de esta feature.
- El recorte del avatar en esta v1 es únicamente visual (CSS `border-radius: 50%` + `object-fit: cover`); no hay recorte real de la imagen ni editor de recorte.
- El campo de nombre tiene un límite de 100 caracteres (AC-008), igual que el nombre de ruta de `mejoras-guardado-rutas.md`.
- Cualquier host nuevo añadido a `connect-src` en la CSP (`tauri.conf.json`) debe ser el host exacto de la API (`https://vpic.nhtsa.dot.gov`), nunca un comodín ni una relajación más amplia (ADR-014).
- La API NHTSA vPIC es gratuita y no requiere API key ni registro — no hay ningún secreto que gestionar en esta integración.
- Todos los elementos interactivos nuevos llevan `data-cy` siguiendo la convención `<contexto>-<tipo>-<accion>` del proyecto (AC-037), y cumplen la hitbox mínima de 56×56px (AC-038).
- Modo oscuro obligatorio y tokens del sistema de diseño ("Asfalto Nocturno") — nunca hardcodear color/fuente/espaciado/sombra/radio, ni usar `--color-*`/`--glow-*`/`--neon-*` (ADR-019).
- Esta spec no introduce edición del vehículo con más de dos tipos (moto/coche) ni datos adicionales del vehículo (año, matrícula, etc.) — fuera de alcance, posible iteración futura.
- Esta spec no introduce renombrado de rutas ni cambios en la persistencia de `routes` — el Bloque 3 solo lee datos ya existentes, sin nuevas tablas ni columnas en `routes`.

## Dependencias
- **`botonera-navegacion`** (`nav-bar.element.ts`, `app.element.ts`): el botón "Perfil", hoy sin acción (AC-008), gana su primera vista real; requiere un nuevo evento de navegación y un nuevo caso en `showView()`.
- **`fotos-ruta` / `mejoras-tecnicas`** (`shared/photo-capture/`, `photo-capture-adapter.service.ts`, `shared/services/photo-storage.service.ts`): el selector de avatar reutiliza el mismo patrón cámara/galería vía `<input type="file">` y el mismo servicio de guardado/lectura de archivos, sin duplicar su lógica de detección Tauri/navegador.
- **`mejoras-guardado-rutas`** (límite de 100 caracteres en campo de texto, patrón de modal con campo de texto y previsualización): referencia directa de patrón ya usado en el proyecto para el campo de nombre y el modal "Editar perfil".
- **Persistencia de rutas** (`IRouteRepository`, `sqlite-route.repository.ts`, `route.types.ts`): fuente de datos de solo lectura para el Bloque 3 (estadísticas); no se modifica su esquema.
- **`design-system.md` §7/§10.10 y `frontend-conventions.md` §4**: gobiernan la promoción de `.stat-tile`/`.stat-grid` a `src/shared/` al aparecer un segundo consumidor.
- **ADR-014** (seguridad — CSP y permisos mínimos): gobierna cómo se añade el host de la API externa a `connect-src`.
- **Primera integración de API pública externa del proyecto**: esta feature sienta el patrón de cliente HTTP compartido (timeout, manejo de errores de red/no-JSON) que features futuras podrán reutilizar.

## Notas de Implementación
- Nuevo dominio `src/profile/` (`profile.element.ts/.css/.service.ts/.transform.ts/.types.ts`), siguiendo la convención de dominio funcional del proyecto (no por tipo técnico).
- Nuevo repositorio siguiendo el patrón ya existente (`IProfileRepository`/`SqliteProfileRepository`/`MemoryProfileRepository`) en `src/shared/repositories/` y `src/shared/models/profile.types.ts`/`profile.repository.ts`. Al ser singleton, la interfaz puede ser más simple que `IRouteRepository`: `get(): Promise<Profile | null>` + `save(profile: CreateProfile): Promise<Profile>` (upsert sobre una única fila).
- Nueva tabla SQLite `profile` (fila única, p. ej. clave fija o `INSERT OR REPLACE`), con columnas equivalentes a: `avatar_path TEXT`, `name TEXT`, `vehicle_type TEXT` (`'motorcycle' | 'car' | NULL`), `vehicle_make TEXT`, `vehicle_model TEXT`. Diseño exacto de columnas/migraciones a fijar en la fase de plan, reutilizando el patrón `ensureColumn()`/`PRAGMA table_info` ya usado en `sqlite-route.repository.ts` si aplica.
- Nuevo cliente HTTP compartido en `src/shared/` (nombre exacto y ubicación a decidir en el plan, p. ej. `shared/http/external-api.service.ts`) con timeout explícito (`AbortController` + `setTimeout`), y manejo diferenciado de error de red, timeout y respuesta no-JSON — pensado como base reutilizable por integraciones externas futuras, no acoplado en su interfaz pública a vPIC.
- Cliente específico de vPIC (marcas por tipo de vehículo, modelos por marca) construido sobre el cliente HTTP compartido; ubicación (`profile/` vs `shared/`) a decidir en el plan según si aporta valor genérico.
- Cambios de configuración a resolver en la fase de plan (posible ADR nuevo si hay una decisión de arquitectura real, ver plantilla de ADR de `memory/decisions.md`): añadir `https://vpic.nhtsa.dot.gov` a `connect-src` en `tauri.conf.json` (mismo patrón que el host ya existente `https://tiles.openfreemap.org`); verificar si el `fetch()` nativo del WebView de Tauri 2 basta para una llamada `connect-src` normal o si hace falta instalar `@tauri-apps/plugin-http` con permiso explícito en `capabilities/default.json`.
- El avatar reutiliza `savePhotoFile`/`getPhotoUrl` de `photo-storage.service.ts` tal cual — no necesita una fila en la tabla `photos` ni asociación a ninguna ruta; el `filePath` devuelto se guarda directamente en la columna `avatar_path` del perfil.
- Cálculo de "velocidad media histórica" (AC-033): media aritmética del campo `avgSpeed` ya persistido de cada ruta completada — no se recalcula desde `route_points` ni se pondera por distancia/tiempo.
- Nuevo evento de navegación `NAV_PERFIL` en `shared/app-events.ts` (mismo patrón que `NAV_GRABAR`/`NAV_RUTAS`), wireado en `nav-bar.element.ts` (`buildPerfilBtn()` gana su `addEventListener`, hoy no tiene ninguno) y en `app.element.ts` (`showView()` gana el caso `'profile'`, nuevo `<profile-view>` montado igual que `cockpit-view`/`route-list`/`route-detail`).
- Promoción de `.stat-tile`/`.stat-grid` desde `cockpit.element.css` a `src/shared/` (ubicación exacta — p. ej. `shared/styles/` o un nuevo `shared/components/stat-tile/` — a decidir en el plan), sin alterar su apariencia actual en el cockpit; ambos consumidores (cockpit y perfil) deben quedar visualmente idénticos a antes de la promoción.
- `data-cy` sugeridos (a confirmar/ajustar en el plan): `profile-avatar-editar`, `profile-btn-editar-perfil`, `profile-input-nombre`, `profile-btn-cambiar-foto`, `profile-btn-guardar-perfil`, `profile-btn-cancelar-perfil`, `profile-btn-editar-vehiculo`, `profile-select-tipo-vehiculo`, `profile-select-marca`, `profile-select-modelo`, `profile-btn-guardar-vehiculo`, `profile-btn-cancelar-vehiculo`.

# 04 · Modelo de datos

Hay **dos bases de datos** con modelos distintos:

1. **PostgreSQL 16** (servidor) — modelo de la API backend, definido por migraciones versionadas en
   `apps/api/internal/migrate/migrations/`.
2. **SQLite** (dispositivo) — modelo local de la app, definido por los repositorios en
   `apps/mobile/src/shared/repositories/`.

## 1. PostgreSQL (backend)

### Diagrama entidad-relación

```mermaid
erDiagram
    users ||--o{ email_verification_tokens : "tiene"
    users ||--o{ password_reset_tokens : "tiene"
    users ||--o{ routes : "posee"
    users ||--o{ route_shares : "emite"
    users ||--o{ route_shares : "recibe"
    users ||--o{ device_tokens : "registra"
    users ||--o{ user_achievements : "desbloquea"

    routes ||--o{ route_points : "contiene"
    routes ||--o{ route_stops : "contiene"
    routes ||--o{ route_photos : "tiene"
    routes ||--o{ route_shares : "compartida"

    stop_types ||--o{ route_stops : "categoriza"

    achievements ||--o{ user_achievements : "otorgado"

    users {
        bigserial id PK
        text email UK
        text password_hash
        boolean email_verified
        timestamptz created_at
        timestamptz updated_at
    }

    routes {
        uuid id PK
        bigint user_id FK
        text created_at
        float duration
        float total_distance
        float avg_speed
        text status
        text name
        text notes
        boolean is_favorite
        timestamptz updated_at
    }

    route_points {
        bigserial id PK
        uuid route_id FK
        bigint timestamp
        float lat
        float lng
        float alt
        float speed
        float matched_lat
        float matched_lng
    }

    route_stops {
        bigserial id PK
        uuid route_id FK
        bigint start_time
        bigint end_time
        float lat
        float lng
        text type
        bigint stop_category_id FK
    }

    route_photos {
        uuid id PK
        uuid route_id FK
        text object_key
        text mime_type
        float latitude
        float longitude
        text captured_at
        timestamptz created_at
    }

    stop_types {
        bigserial id PK
        text key UK
        text label
        text icon
    }

    route_shares {
        uuid id PK
        uuid route_id FK
        bigint from_user_id FK
        bigint to_user_id FK
        text status
        timestamptz created_at
        timestamptz updated_at
    }

    achievements {
        bigserial id PK
        text key UK
        text requirement_type
        float threshold
        text title
        text description
        text icon
        timestamptz created_at
    }

    user_achievements {
        bigserial id PK
        bigint user_id FK
        bigint achievement_id FK
        timestamptz achieved_at
    }

    device_tokens {
        bigserial id PK
        bigint user_id FK
        text token UK
        text platform
        timestamptz created_at
        timestamptz updated_at
    }

    email_verification_tokens {
        bigserial id PK
        bigint user_id FK
        text token_hash UK
        timestamptz expires_at
        timestamptz used_at
        timestamptz created_at
    }

    password_reset_tokens {
        bigserial id PK
        bigint user_id FK
        text token_hash UK
        timestamptz expires_at
        timestamptz used_at
        timestamptz created_at
    }
```

### Migraciones (orden de aplicación)

| Fichero | Contenido |
|---------|-----------|
| `0001_create_users.sql` | Tabla `users` |
| `0002_create_stop_types.sql` | Catálogo `stop_types` + seed (8 tipos) |
| `0003_add_email_verification.sql` | `email_verified` + `email_verification_tokens` |
| `0004_add_password_reset.sql` | `password_reset_tokens` |
| `0005_create_routes.sql` | `routes`, `route_points`, `route_stops` |
| `0006_create_route_photos.sql` | `route_photos` |
| `0007_add_route_favorite.sql` | `is_favorite` en `routes` |
| `0008_create_route_shares.sql` | `route_shares` |
| `0009_create_achievements.sql` | `achievements` + `user_achievements` + seed (10 logros) |
| `0010_create_device_tokens.sql` | `device_tokens` (FCM) |
| `0011_add_route_points_matched.sql` | `matched_lat`/`matched_lng` en `route_points` |

Las migraciones se aplican al arrancar la API (`migrate.Run`) y quedan registradas en la tabla
`schema_migrations` (version + applied_at). Son idempotentes.

### Notas del modelo

- `users.id` es `BIGSERIAL` (entero), mientras que `routes.id`, `route_photos.id` y `route_shares.id`
  son `UUID`.
- `routes.created_at` es `TEXT` libre (el cliente envía ISO 8601); hay una función
  `safe_parse_timestamptz()` para castear de forma tolerante en agregados de logros.
- Las relaciones usan `ON DELETE CASCADE` (borrar un usuario/ruta borra sus dependencias).
- `device_tokens.token` es único (un token FCM por fila).
## 2. SQLite (dispositivo / app móvil)

Persistencia local vía `@tauri-apps/plugin-sql`, gestionada por los repositorios en
`src/shared/repositories/`. No hay autenticación multi-usuario en el dispositivo: las tablas
`session` y `profile` son de **fila única** (`id = 1`).

### Diagrama entidad-relación

```mermaid
erDiagram
    routes ||--o{ route_points : "contiene"
    routes ||--o{ route_stops : "contiene"
    routes ||--o{ photos : "tiene"

    routes {
        text id PK
        text created_at
        real duration
        real total_distance
        real avg_speed
        text status
        text visibility
        text origin
    }

    route_points {
        text id PK
        text route_id FK
        integer timestamp
        real lat
        real lng
        real alt
        real speed
    }

    route_stops {
        text id PK
        text route_id FK
        integer start_time
        integer end_time
        real lat
        real lng
        text type
        integer stop_type_id
    }

    photos {
        text id PK
        text route_id FK
        text file_path
        real latitude
        real longitude
        text captured_at
        text created_at
    }

    session {
        integer id PK
        text token
        text email
    }

    profile {
        integer id PK
        text avatar_path
        text name
        text vehicle_type
        text vehicle_make
        text vehicle_model
    }
```

### Tablas y repositorios

| Tabla(s) | Repositorio | Propósito |
|----------|-------------|-----------|
| `routes`, `route_points`, `route_stops` | `sqlite-route.repository.ts` | Rutas grabadas y sus puntos/paradas |
| `photos` | `sqlite-photo.repository.ts` | Fotos locales (path en `$APPDATA/photos`) |
| `session` | `sqlite-session.repository.ts` | Sesión JWT del usuario (fila única) |
| `profile` | `sqlite-profile.repository.ts` | Perfil y vehículo del usuario (fila única) |

### Notas

- `routes.visibility` (`private`/`public`) y `routes.origin` (`local`/`cloud`) son campos propios de
  la copia local que no existen en el modelo del backend (allí el origen lo determina el usuario
  dueño de la fila y la visibilidad se gestiona en la lógica).
- Las claves foráneas usan `ON DELETE CASCADE`.
- La migración de esquema se hace con `CREATE TABLE IF NOT EXISTS` memoizado (`ensureSchema()`) y, en
  el caso de `photos`, un `PRAGMA table_info` para añadir columnas nuevas a tablas ya existentes.
- Los repositorios se instancian a través de **factories** (`sqlite-*.factory.ts`) que inyectan la
  conexión; hay variantes en memoria (`memory-*.repository.ts`) para tests.


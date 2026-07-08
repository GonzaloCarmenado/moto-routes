# Políticas de Seguridad para SDD

## Principios Fundamentales

### 1. Secretos: Nunca en Código

**Regla absoluta**: Ninguna contraseña, token, clave privada, cadena de conexión o secreto de API debe estar en el código fuente.

| Tipo | En código | Dónde va |
|------|-----------|----------|
| API Keys privadas | ❌ PROHIBIDO | GitHub Secrets → variables de entorno |
| Contraseñas DB | ❌ PROHIBIDO | GitHub Secrets → variables de entorno |
| Tokens JWT secret | ❌ PROHIBIDO | GitHub Secrets → variables de entorno |
| Cadenas de conexión con credenciales | ❌ PROHIBIDO | GitHub Secrets → variables de entorno |
| Claves públicas (Supabase anon key) | ✅ PERMITIDO | Código (son públicas por diseño) |
| URLs de API (sin credenciales) | ✅ PERMITIDO | Configuración |
| Identificadores públicos | ✅ PERMITIDO | Código |

**Implementación**:
- `.env.example` con nombres de variables y valores de ejemplo (nunca reales)
- `.env` en `.gitignore` (NUNCA se commitea)
- En GitHub: Settings → Secrets and variables → Actions
- En local: variables de entorno o `.env` (gitignorado)

### 2. CSP (Content Security Policy) Estricta

**Regla**: La CSP debe ser lo más restrictiva posible. Solo permitir los orígenes estrictamente necesarios.

```
Política base restrictiva:
  default-src 'self'
  script-src 'self'
  style-src 'self'
  img-src 'self' data:
  connect-src 'self'
  font-src 'self'
  frame-src 'none'
  object-src 'none'
  base-uri 'self'
  form-action 'self'

PROHIBIDO en producción:
  ❌ 'unsafe-inline' (scripts)
  ❌ 'unsafe-eval'
  ❌ '*'
  ❌ data: en script-src
  ❌ blob: en script-src

PERMITIDO SOLO en desarrollo:
  - 'unsafe-inline' para HMR de Vite
  - Conexiones a localhost
```

**Nota para Tauri**: La CSP se configura tanto en `index.html` (meta tag) como en `tauri.conf.json` (app.security.csp).

### 3. Auditoría de Dependencias en Pre-Commit

**Regla**: Cada commit debe pasar una auditoría de vulnerabilidades conocidas.

| Nivel de severidad | Comportamiento |
|-------------------|----------------|
| **Critical** | ❌ BLOQUEAR commit |
| **High** | ❌ BLOQUEAR commit |
| **Moderate** | ⚠️ WARNING (no bloquea, pero alerta) |
| **Low** | ℹ️ INFO (no bloquea) |

**Herramientas**:
- Frontend: `npm audit` (con `--audit-level=high` para bloquear)
- Backend Rust: `cargo audit` (con `--deny=warnings` para warning, `--deny=high` para alto)
- Python (futuro): `pip-audit` o `safety`

**Implementación en Husky**:
```bash
# npm audit: bloquea en high/critical, warning en moderate
npm audit --audit-level=high || exit 1

# cargo audit: warning en todo, bloquea en high/critical
cargo audit --deny high
```

### 4. Validación de Inputs

- **Frontend**: Validación de formularios con tipos TypeScript estrictos
- **Backend**: Validación de todos los inputs recibidos del frontend (defensa en profundidad)
- **APIs externas**: Sanitizar respuestas antes de usarlas

### 5. Dependencias Mínimas

- No añadir dependencias innecesarias
- Preferir APIs nativas sobre librerías externas cuando sea posible
- Revisar la salud del paquete antes de añadirlo (mantenimiento, issues, descargas)
- Evitar dependencias con pocos maintainers o sin actualizaciones recientes

### 6. Configuración de GitHub

- **Branch protection**: main requiere PR review + CI verde
- **Secret scanning**: Activado en el repositorio
- **Dependabot**: Activado para alertas de seguridad automáticas
- **CODEOWNERS**: Archivo con responsables de revisión
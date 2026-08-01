# Estrategia de Tests E2E con Cypress

## Principios Fundamentales

### 1. Selectores data-cy (NO clases, NO IDs, NO estilos)

**Regla absoluta**: Todo elemento interactivo debe tener un atributo `data-cy` único y descriptivo. Los tests NUNCA usan selectores CSS de clase, ID, o estilo.

```html
<!-- ❌ MAL: selectores que dependen de la implementación visual -->
<button class="btn-primary">Guardar</button>
cy.get('.btn-primary').click()

<!-- ❌ MAL: IDs genéricos o autogenerados -->
<button id="submit-123">Guardar</button>
cy.get('#submit-123').click()

<!-- ✅ BIEN: data-cy semántico y único -->
<button data-cy="form-clientes-btn-guardar">Guardar</button>
cy.get('[data-cy="form-clientes-btn-guardar"]').click()
```

**Convención de nomenclatura**: `data-cy="<contexto>-<tipo>-<accion>"`

| Contexto | Tipo | Ejemplo |
|----------|------|---------|
| `form-clientes` | `btn` | `form-clientes-btn-guardar` |
| `form-clientes` | `input` | `form-clientes-input-nombre` |
| `form-clientes` | `select` | `form-clientes-select-pais` |
| `tabla-clientes` | `row` | `tabla-clientes-row-editar` |
| `tabla-clientes` | `btn` | `tabla-clientes-btn-eliminar` |
| `modal-confirm` | `btn` | `modal-confirm-btn-aceptar` |
| `nav` | `link` | `nav-link-clientes` |

### 2. Tests Autocontenidos (Parallelizables)

Cada fichero de test debe ser **autocontenido e independiente**. No debe depender del estado dejado por otro test. Esto permite ejecución paralela y evita tests frágiles.

**Patrón CRUD completo en un solo fichero**:

```typescript
describe('Clientes - CRUD completo', () => {
  // Cada it() es independiente
  it('CREATE: alta de cliente con todos los campos', () => { ... });
  it('READ: visualización del cliente creado', () => { ... });
  it('UPDATE: edición de todos los campos del cliente', () => { ... });
  it('DELETE: eliminación del cliente y verificación', () => { ... });
});
```

**Reglas de autocontención**:
- Cada `describe` crea sus propios datos de prueba
- Cada `describe` limpia sus datos al finalizar
- No se comparte estado entre ficheros
- Los datos se crean vía UI (no directamente en BD) para validar el flujo completo
- No se valida el ID autogenerado (puede variar entre entornos)

### 3. Validación Exhaustiva de Formularios

Un test de formulario debe validar **TODOS** los campos, no solo los obligatorios:

```typescript
it('CREATE: alta de cliente con todos los campos', () => {
  // 1. Navegar al formulario
  cy.visit('/clientes/nuevo');
  
  // 2. Rellenar TODOS los campos
  cy.get('[data-cy="form-cliente-input-nombre"]').type('María');
  cy.get('[data-cy="form-cliente-input-apellidos"]').type('García López');
  cy.get('[data-cy="form-cliente-input-email"]').type('maria@example.com');
  cy.get('[data-cy="form-cliente-input-telefono"]').type('612345678');
  cy.get('[data-cy="form-cliente-select-pais"]').select('ES');
  cy.get('[data-cy="form-cliente-input-direccion"]').type('Calle Mayor 1');
  cy.get('[data-cy="form-cliente-input-codigo-postal"]').type('28001');
  cy.get('[data-cy="form-cliente-input-nif"]').type('12345678Z');
  cy.get('[data-cy="form-cliente-checkbox-newsletter"]').check();
  cy.get('[data-cy="form-cliente-textarea-notas"]').type('Cliente VIP');
  
  // 3. Guardar
  cy.get('[data-cy="form-cliente-btn-guardar"]').click();
  
  // 4. Validar que todos los campos se guardaron correctamente
  cy.get('[data-cy="detalle-cliente-nombre"]').should('contain.text', 'María');
  cy.get('[data-cy="detalle-cliente-apellidos"]').should('contain.text', 'García López');
  cy.get('[data-cy="detalle-cliente-email"]').should('contain.text', 'maria@example.com');
  cy.get('[data-cy="detalle-cliente-telefono"]').should('contain.text', '612345678');
  cy.get('[data-cy="detalle-cliente-pais"]').should('contain.text', 'España');
  cy.get('[data-cy="detalle-cliente-direccion"]').should('contain.text', 'Calle Mayor 1');
  cy.get('[data-cy="detalle-cliente-nif"]').should('contain.text', '12345678Z');
  cy.get('[data-cy="detalle-cliente-notas"]').should('contain.text', 'Cliente VIP');
});
```

### 4. Agrupaciones Lógicas con describe/it

```typescript
// ✅ BIEN: Agrupación lógica por feature
describe('Módulo Clientes', () => {
  
  describe('Alta de cliente', () => {
    it('debe crear cliente con todos los campos', () => { ... });
    it('debe mostrar error si falta email', () => { ... });
    it('debe validar formato de email', () => { ... });
    it('debe validar formato de NIF', () => { ... });
    it('debe permitir cancelar y volver al listado', () => { ... });
  });

  describe('Edición de cliente', () => {
    it('debe editar todos los campos', () => { ... });
    it('debe mantener campos no modificados', () => { ... });
  });

  describe('Eliminación de cliente', () => {
    it('debe pedir confirmación antes de eliminar', () => { ... });
    it('debe eliminar cliente y redirigir al listado', () => { ... });
    it('debe mostrar mensaje si el cliente tiene pedidos asociados', () => { ... });
  });

  describe('Listado de clientes', () => {
    it('debe mostrar tabla con columnas esperadas', () => { ... });
    it('debe filtrar por nombre', () => { ... });
    it('debe paginar resultados', () => { ... });
    it('debe ordenar por columna', () => { ... });
  });
});
```

### 5. Fixtures para Datos de Prueba

Centralizar datos de prueba en `cypress/fixtures/`:

```json
// cypress/fixtures/clientes.json
{
  "nuevoCliente": {
    "nombre": "María",
    "apellidos": "García López",
    "email": "maria@example.com",
    "telefono": "612345678",
    "pais": "ES",
    "direccion": "Calle Mayor 1",
    "codigoPostal": "28001",
    "nif": "12345678Z",
    "notas": "Cliente VIP"
  },
  "clienteEditado": {
    "nombre": "María Editada",
    "apellidos": "García Modificado",
    "email": "maria.editada@example.com"
  }
}
```

### 6. Custom Commands para Operaciones Repetitivas

```typescript
// cypress/support/commands.ts

Cypress.Commands.add('crearCliente', (datos) => {
  cy.visit('/clientes/nuevo');
  cy.get('[data-cy="form-cliente-input-nombre"]').type(datos.nombre);
  cy.get('[data-cy="form-cliente-input-apellidos"]').type(datos.apellidos);
  cy.get('[data-cy="form-cliente-input-email"]').type(datos.email);
  // ... resto de campos
  cy.get('[data-cy="form-cliente-btn-guardar"]').click();
  cy.get('[data-cy="toast-success"]').should('be.visible');
});
```

### 7. Intercept para Rendimiento y Fixtures

```typescript
// Interceptar API para evitar dependencia del backend real en ciertos tests
cy.intercept('GET', '/api/clientes*', { fixture: 'clientes.json' }).as('getClientes');
cy.wait('@getClientes');
```

### 8. Estructura de Directorios Cypress

```
cypress/
├── e2e/
│   ├── clientes/
│   │   ├── crud-clientes.cy.ts       # CRUD completo autocontenido
│   │   ├── validaciones.cy.ts        # Validaciones de formulario
│   │   └── listado.cy.ts             # Listado, filtros, paginación
│   ├── auth/
│   │   └── login.cy.ts
│   └── navegacion/
│       └── menu.cy.ts
├── fixtures/
│   ├── clientes.json
│   └── usuarios.json
├── support/
│   ├── commands.ts                   # Custom commands
│   └── e2e.ts                        # Configuración global
└── cypress.config.ts
```

### 9. Configuración Recomendada de Cypress

```typescript
// cypress.config.ts
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:1420',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    retries: {
      runMode: 2,
      openMode: 0,
    },
    video: false,
    screenshotOnRunFailure: true,
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    env: {
      apiUrl: 'http://localhost:1420/api',
    },
  },
});
```

### 10. Ejemplo Completo de Test Autocontenido

```typescript
// cypress/e2e/clientes/crud-clientes.cy.ts

describe('Clientes - CRUD completo', () => {
  const timestamp = Date.now();
  const clienteBase = {
    nombre: `Test ${timestamp}`,
    apellidos: 'Apellido Test',
    email: `test.${timestamp}@example.com`,
    telefono: '612345678',
    pais: 'ES',
    direccion: 'Calle Test 123',
    codigoPostal: '28001',
    nif: `X${String(timestamp).slice(-7)}A`,
    notas: 'Cliente creado en test E2E',
  };

  // Cada test es independiente: crea → usa → limpia

  it('CREATE: alta de cliente con todos los campos', () => {
    cy.visit('/clientes/nuevo');
    
    // Rellenar todos los campos sin excepción
    cy.get('[data-cy="form-cliente-input-nombre"]').type(clienteBase.nombre);
    cy.get('[data-cy="form-cliente-input-apellidos"]').type(clienteBase.apellidos);
    cy.get('[data-cy="form-cliente-input-email"]').type(clienteBase.email);
    cy.get('[data-cy="form-cliente-input-telefono"]').type(clienteBase.telefono);
    cy.get('[data-cy="form-cliente-select-pais"]').select(clienteBase.pais);
    cy.get('[data-cy="form-cliente-input-direccion"]').type(clienteBase.direccion);
    cy.get('[data-cy="form-cliente-input-codigo-postal"]').type(clienteBase.codigoPostal);
    cy.get('[data-cy="form-cliente-input-nif"]').type(clienteBase.nif);
    cy.get('[data-cy="form-cliente-textarea-notas"]').type(clienteBase.notas);
    
    cy.get('[data-cy="form-cliente-btn-guardar"]').click();
    
    // Verificar redirección a detalle
    cy.url().should('include', '/clientes/');
    
    // Verificar que todos los campos se muestran correctamente
    // Sin validar el ID (es autogenerado)
    cy.get('[data-cy="detalle-cliente-nombre"]').should('contain.text', clienteBase.nombre);
    cy.get('[data-cy="detalle-cliente-apellidos"]').should('contain.text', clienteBase.apellidos);
    cy.get('[data-cy="detalle-cliente-email"]').should('contain.text', clienteBase.email);
    cy.get('[data-cy="detalle-cliente-telefono"]').should('contain.text', clienteBase.telefono);
    cy.get('[data-cy="detalle-cliente-direccion"]').should('contain.text', clienteBase.direccion);
    cy.get('[data-cy="detalle-cliente-nif"]').should('contain.text', clienteBase.nif);
    cy.get('[data-cy="detalle-cliente-notas"]').should('contain.text', clienteBase.notas);
    
    // Guardar el ID generado para usarlo en la limpieza
    cy.url().then((url) => {
      const id = url.split('/').pop();
      cy.wrap(id).as('clienteId');
    });
  });

  it('UPDATE: edición de todos los campos del cliente', function () {
    const clienteEditado = {
      nombre: `${clienteBase.nombre} Editado`,
      apellidos: 'Apellido Modificado',
      email: `editado.${timestamp}@example.com`,
    };

    // Navegar al listado y buscar por email para encontrar el cliente
    cy.visit('/clientes');
    cy.get('[data-cy="listado-clientes-input-buscar"]').type(clienteBase.email);
    cy.get('[data-cy="listado-clientes-btn-buscar"]').click();
    
    // Click en editar de la primera fila
    cy.get('[data-cy="listado-clientes-row-editar"]').first().click();
    
    // Modificar campos
    cy.get('[data-cy="form-cliente-input-nombre"]').clear().type(clienteEditado.nombre);
    cy.get('[data-cy="form-cliente-input-apellidos"]').clear().type(clienteEditado.apellidos);
    cy.get('[data-cy="form-cliente-input-email"]').clear().type(clienteEditado.email);
    
    cy.get('[data-cy="form-cliente-btn-guardar"]').click();
    
    // Verificar cambios
    cy.get('[data-cy="detalle-cliente-nombre"]').should('contain.text', clienteEditado.nombre);
    cy.get('[data-cy="detalle-cliente-apellidos"]').should('contain.text', clienteEditado.apellidos);
    cy.get('[data-cy="detalle-cliente-email"]').should('contain.text', clienteEditado.email);
  });

  it('DELETE: eliminación del cliente y verificación en listado', () => {
    // Navegar al listado
    cy.visit('/clientes');
    
    // Buscar el cliente por email
    cy.get('[data-cy="listado-clientes-input-buscar"]').type(clienteBase.email);
    cy.get('[data-cy="listado-clientes-btn-buscar"]').click();
    
    // Click en eliminar
    cy.get('[data-cy="listado-clientes-row-eliminar"]').first().click();
    
    // Confirmar en modal
    cy.get('[data-cy="modal-confirm-btn-aceptar"]').click();
    
    // Verificar que desaparece del listado
    cy.get('[data-cy="listado-clientes-input-buscar"]').clear().type(clienteBase.email);
    cy.get('[data-cy="listado-clientes-btn-buscar"]').click();
    cy.get('[data-cy="listado-clientes-empty"]').should('be.visible');
  });
});
```

## Lo que NO se Debe Hacer

```typescript
// ❌ Usar clases CSS (frágil, cambia con el diseño)
cy.get('.btn-primary').click();

// ❌ Usar IDs autogenerados (cambian entre entornos)
cy.get('#user-12345').click();

// ❌ Depender de la posición en el DOM
cy.get('button').eq(3).click();

// ❌ Tests que dependen de estado de otro test
let clienteId; // compartido entre tests → error en paralelo

// ❌ Validar solo campos obligatorios
cy.get('[data-cy="detalle-cliente-nombre"]').should('contain.text', 'María');
// (falta validar email, teléfono, dirección, etc.)

// ❌ Hardcodear IDs de BD
cy.visit('/clientes/42'); // Este ID puede no existir en otro entorno

// ❌ Esperar tiempos fijos
cy.wait(5000); // Frágil, lento
cy.get('[data-cy="loading"]', { timeout: 10000 }).should('not.exist'); // ✅ Mejor
```

## Scripts npm para Cypress

```json
{
  "scripts": {
    "cy:open": "cypress open",
    "cy:run": "cypress run",
    "cy:run:clientes": "cypress run --spec 'cypress/e2e/clientes/**/*'",
    "cy:run:headless": "cypress run --headless",
    "test:e2e": "start-server-and-test dev http://localhost:1420 cy:run"
  }
}
```

## Integración con Pre-Commit

Los tests E2E **sí** se ejecutan en pre-commit (`.husky/pre-commit`): al final de la cadena de checks, `pnpm test:e2e` levanta Vite en `:1420` vía `start-server-and-test` y ejecuta todos los specs en headless. Esto garantiza que ningún cambio que rompa los flujos principales (grabación, listado, detalle, fotos, timeline) llegue a `master`. Para iterar rápido localmente se pueden ejecutar de forma aislada con `pnpm cy:open` o `pnpm cy:run`.

Los tests E2E también se ejecutan en CI/CD:

```yaml
# .github/workflows/e2e.yml (ejemplo)
- name: Cypress E2E Tests
  uses: cypress-io/github-action@v6
  with:
    start: npm run dev
    wait-on: http://localhost:1420
    browser: chrome
```

## Siembra de datos en Moto Routes

Moto Routes no tiene backend de API para interceptar con `cy.intercept()` — la persistencia real (SQLite vía Tauri) no está disponible en el navegador de tests. En su lugar, la app expone un mecanismo de siembra vía `localStorage`, exclusivo de entornos fuera de Tauri (`isTauri() === false`), que precarga datos directamente en el repositorio en memoria antes de que la UI renderice.

### `cy.visitWithSeed()`

Comando compartido (`cypress/support/commands.ts`) que centraliza la escritura en `localStorage` para no repetirla inline en cada spec:

```typescript
cy.visitWithSeed({
  routes: [{ id: crypto.randomUUID(), name: 'Ruta test', createdAt: new Date().toISOString(), /* ... */ }],
  points: { [routeId]: [{ lat: 40.4, lng: -3.7, speed: 40, timestamp: '...' }] },
  stops: { [routeId]: [] },
  photos: [{ id: crypto.randomUUID(), routeId, filePath: 'photos/seed-0.jpg', capturedAt: '...' }],
  path: '/', // por defecto
});
```

- **Rutas** (`routes`, + `points`/`stops` opcionales): se serializan bajo la clave `cypress-seed-routes`. `applyCypressSeed()` (`src/app/app-seed.service.ts`) la lee — solo si `isTauri()` es `false` — y llama a `MemoryRouteRepository.seed()`, poblando el repositorio sin pasar por el flujo normal de grabación/guardado.
- **Fotos** (`photos`): se serializan bajo la clave real `moto-routes-photos` — la misma que ya lee `MemoryPhotoRepository` en cada instancia nueva. No existe ningún mecanismo de producción nuevo para fotos: sembrar esa clave antes de `cy.visit()` es suficiente, el propio repositorio ya la consume tal cual.
- `onBeforeLoad` (no `cy.window().then(...)` después de un `cy.visit()` normal) es imprescindible: `app.element.ts` lee `localStorage` de forma síncrona nada más cargar el módulo, así que la clave debe existir *antes* de que la página empiece a ejecutar su JS.
- Cada test genera sus propios `id` con `crypto.randomUUID()` y nombres de ruta únicos (`` `Ruta test ${Date.now()}` ``) para permanecer autocontenido y paralelizable.
- Fuera de Tauri sin ninguna clave sembrada, la app arranca igual que hoy (repositorio vacío) — `cy.visitWithSeed({})` equivale a `cy.visit('/')`.
- En build de producción Android/Tauri (`isTauri() === true`), este mecanismo nunca se activa, sin importar el contenido de `localStorage`.

## Requisitos para Componentes

Todo componente debe incluir `data-cy` en sus elementos interactivos:

```typescript
// ✅ Componente con data-cy
render() {
  return `
    <form>
      <input data-cy="form-cliente-input-nombre" type="text" />
      <input data-cy="form-cliente-input-email" type="email" />
      <button data-cy="form-cliente-btn-guardar">Guardar</button>
      <button data-cy="form-cliente-btn-cancelar">Cancelar</button>
    </form>
  `;
}
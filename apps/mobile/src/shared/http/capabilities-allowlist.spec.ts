import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mismo patrón que tauri-conf.spec.ts: src-tauri/ no está en `test.include` de
// vitest.config.ts, así que este test de guarda vive bajo `src/` y lee
// `capabilities/default.json` directamente por ruta relativa.
const capabilitiesPath = resolve(process.cwd(), 'src-tauri/capabilities/default.json');
const capabilities = JSON.parse(readFileSync(capabilitiesPath, 'utf8')) as {
  permissions: (string | { identifier: string })[];
};

/** Un permiso puede declararse como string plano o como objeto `{ identifier, allow }`. */
function permissionIdentifier(permission: string | { identifier: string }): string {
  return typeof permission === 'string' ? permission : permission.identifier;
}

// Lista explícita y conocida (ADR-014: permisos mínimos). Cualquier cambio real
// —añadir o quitar un permiso— debe pasar por aquí a propósito, nunca colarse
// sin que nadie lo note.
const KNOWN_PERMISSIONS = [
  'core:default',
  'opener:default',
  'log:default',
  'sql:default',
  'sql:allow-load',
  'sql:allow-execute',
  'sql:allow-select',
  'core:window:default',
  'core:window:allow-close',
  'core:window:allow-set-size',
  'core:window:allow-set-position',
  'notification:default',
  'dialog:allow-save',
  'fs:allow-mkdir',
  'fs:allow-exists',
  'fs:allow-write-file',
  'fs:allow-read-file',
  'fs:allow-remove',
  'fs:allow-rename',
  'http:default',
].sort();

describe('src-tauri/capabilities/default.json — allowlist de permisos mínimos (ADR-014)', () => {
  it('declares exactly the known set of permissions, no more, no less', () => {
    const actual = capabilities.permissions.map(permissionIdentifier).sort();

    expect(actual).toEqual(KNOWN_PERMISSIONS);
  });

  it('scopes every fs permission to $APPDATA/photos or $APPCACHE/updates, never a broader path', () => {
    const fsPermissions = capabilities.permissions.filter(
      (p): p is { identifier: string; allow: { path: string }[] } =>
        typeof p === 'object' && p.identifier.startsWith('fs:'),
    );

    expect(fsPermissions.length).toBeGreaterThan(0);
    for (const permission of fsPermissions) {
      for (const scope of permission.allow) {
        const isKnownScope = scope.path.startsWith('$APPDATA/photos') || scope.path.startsWith('$APPCACHE/updates');
        expect(isKnownScope).toBe(true);
      }
    }
  });

  it('scopes http:default to exact GitHub Releases hosts, never a wildcard (actualizacion-in-app)', () => {
    const httpPermission = capabilities.permissions.find(
      (p): p is { identifier: string; allow: { url: string }[] } => typeof p === 'object' && p.identifier === 'http:default',
    );

    expect(httpPermission).toBeDefined();
    const urls = httpPermission?.allow.map((scope) => scope.url) ?? [];
    expect(urls).toEqual([
      'https://api.github.com/repos/crzverde/moto-routes/releases/latest',
      'https://github.com/crzverde/moto-routes/releases/download/*',
      'https://release-assets.githubusercontent.com/*',
    ]);
    for (const url of urls) {
      expect(url).not.toContain('*.');
    }
  });
});

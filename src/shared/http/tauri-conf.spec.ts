import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// `src-tauri/` no está incluido en `test.include` de vitest.config.ts (solo
// `src/**/*.spec.ts`), así que este test de guarda vive bajo `src/` y lee
// `tauri.conf.json` directamente por ruta relativa — mismo patrón que
// `nav-bar.element.spec.ts` usa para leer su propio `.css` fuente.
const tauriConfPath = resolve(process.cwd(), 'src-tauri/tauri.conf.json');
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8')) as {
  app: { security: { csp: string } };
};
const csp = tauriConf.app.security.csp;

/**
 * Extrae únicamente el fragmento `connect-src ...;` de la CSP completa, para
 * no dar un falso positivo si el host buscado apareciera en otra directiva
 * (p. ej. `img-src`).
 */
function extractConnectSrc(fullCsp: string): string {
  const match = /connect-src[^;]*;/.exec(fullCsp);
  if (!match) {
    throw new Error('connect-src directive not found in CSP');
  }
  return match[0];
}

describe('src-tauri/tauri.conf.json — CSP connect-src (AC-018, AC-019 habilitador)', () => {
  it('includes the vPIC host in connect-src, not in another directive', () => {
    const connectSrc = extractConnectSrc(csp);

    expect(connectSrc).toContain('https://vpic.nhtsa.dot.gov');
  });

  it('adds the vPIC host as an exact host, never a wildcard', () => {
    const connectSrc = extractConnectSrc(csp);
    const sources = connectSrc.replace(/^connect-src\s+/, '').replace(/;$/, '').split(/\s+/);

    expect(sources).toContain('https://vpic.nhtsa.dot.gov');
    expect(sources).not.toContain('https://*.nhtsa.dot.gov');
    expect(sources).not.toContain('*');
    expect(connectSrc).not.toMatch(/https:\/\/\*\.nhtsa\.dot\.gov/);
  });
});

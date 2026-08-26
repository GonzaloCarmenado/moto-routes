import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mismo patrón que ci-workflow.spec.ts (este mismo directorio): aserciones de
// texto plano sobre el fichero real de la raíz del monorepo. Vive junto a
// ci-workflow.spec.ts por ser transversal (pnpm-workspace.yaml), no específico
// de apps/mobile — mismo criterio que ya justifica ese fichero estar aquí.
const workspacePath = resolve(process.cwd(), '../../pnpm-workspace.yaml');
const mobilePackageJsonPath = resolve(process.cwd(), '../../apps/mobile/package.json');
const webPackageJsonPath = resolve(process.cwd(), '../../apps/web/package.json');

function readWorkspace(): string {
  return readFileSync(workspacePath, 'utf8');
}

describe('pnpm-workspace.yaml — resuelve apps/mobile y apps/web (monorepo-layout)', () => {
  it('lista apps/mobile como paquete del workspace', () => {
    expect(readWorkspace()).toMatch(/^\s*-\s*apps\/mobile\s*$/m);
  });

  it('lista apps/web como paquete del workspace', () => {
    expect(readWorkspace()).toMatch(/^\s*-\s*apps\/web\s*$/m);
  });

  it('no lista apps/api (proyecto Go independiente, sin package.json)', () => {
    expect(readWorkspace()).not.toMatch(/apps\/api/);
  });

  it('apps/mobile y apps/web declaran nombres de paquete pnpm distintos', () => {
    const mobileName = (JSON.parse(readFileSync(mobilePackageJsonPath, 'utf8')) as { name: string }).name;
    const webName = (JSON.parse(readFileSync(webPackageJsonPath, 'utf8')) as { name: string }).name;
    expect(mobileName).not.toBe(webName);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mismo patrón que ci-workflow.spec.ts: aserciones de texto plano sobre el
// fichero real, sin parser de Kotlin/Gradle nuevo (no es dependencia del
// proyecto y no se instala sin confirmarlo antes).
const gradlePath = resolve(process.cwd(), 'src-tauri/gen/android/app/build.gradle.kts');

function readGradle(): string {
  return readFileSync(gradlePath, 'utf8');
}

describe('build.gradle.kts — firma de release persistente (openspec/changes/actualizacion-in-app)', () => {
  it('declares a persistent release signingConfig driven by env vars, not the debug keystore unconditionally', () => {
    const gradle = readGradle();
    expect(gradle).toMatch(/ANDROID_RELEASE_KEYSTORE_PATH/);
    expect(gradle).toMatch(/ANDROID_RELEASE_KEYSTORE_PASSWORD/);
    expect(gradle).toMatch(/ANDROID_RELEASE_KEY_ALIAS/);
  });

  it('falls back to the debug keystore only when the persistent keystore env vars are absent (local builds without the secret)', () => {
    const gradle = readGradle();
    expect(gradle).toMatch(/signingConfigs\.getByName\("debug"\)/);
    expect(gradle).not.toMatch(
      /getByName\("release"\) \{[\s\S]*?signingConfig = signingConfigs\.getByName\("debug"\)[\s\S]*?\}/,
    );
  });

  it('the release buildType signingConfig is conditional on the persistent keystore path being set', () => {
    const gradle = readGradle();
    const releaseBlockMatch = /getByName\("release"\) \{([\s\S]*?)\n {8}\}/.exec(gradle);
    expect(releaseBlockMatch).not.toBeNull();
    expect(releaseBlockMatch?.[1]).toMatch(/signingConfig = if \(/);
  });
});

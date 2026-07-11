import { execSync } from 'child_process';

try {
  const result = execSync(
    `pwsh -NoProfile -Command "Get-NetTCPConnection -LocalPort 1420 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`,
    { stdio: 'pipe', timeout: 5000 },
  );
} catch {
  // Ignorar errores (puerto no ocupado o PowerShell no disponible)
}
import { defineConfig } from 'vite';

// En producción apps/web se sirve desde el propio binario de apps/api (mismo
// origen, ver design.md de dashboard-reporting) — en desarrollo, este proxy
// reenvía a la API real sin necesitar CORS en ningún entorno.
const apiProxyTarget = process.env.WEB_DEV_API_PROXY_TARGET || 'http://localhost:8080';

export default defineConfig(({ command }) => ({
  // El build de producción se sirve bajo /dashboard/* (apps/api/internal/webui,
  // embed.FS) — sin esto, index.html referencia los assets con rutas absolutas
  // a la raíz del origen (/assets/...) en vez de /dashboard/assets/..., un 404
  // real verificado con `docker compose up --build` (ver dashboard-reporting,
  // tasks.md 7.1). El dev server sigue sirviendo desde la raíz (/).
  base: command === 'build' ? '/dashboard/' : '/',
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 200,
  },
  server: {
    port: 4200,
    strictPort: true,
    proxy: {
      '/api': apiProxyTarget,
      '/admin': apiProxyTarget,
    },
  },
}));

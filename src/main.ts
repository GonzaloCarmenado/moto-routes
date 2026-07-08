import './app/app.element.js';

// Solo montar si estamos en un navegador (evitar errores en SSR/Node)
if (typeof window !== 'undefined') {
  const app = document.createElement('app-root');
  document.body.appendChild(app);
}
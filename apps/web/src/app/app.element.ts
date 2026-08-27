/**
 * Web Component `<app-root>`: shell de la aplicación (DOM ligero, no Shadow
 * DOM — mismo patrón que `app-root` en `apps/mobile`). Todo el contenido de
 * la app está detrás de sesión en este cambio (capability `web-dashboard`):
 * sin sesión válida, cualquier ruta redirige a `/login`.
 */
import '../login/login-view.element.js';
import '../reporting/reporting-view.element.js';
import { BaseElement } from '../shared/base-element.js';
import { sessionStore } from '../shared/session/session.store.js';
import { SESSION_INVALIDATED_EVENT } from '../shared/session/session-events.js';
import { LOGIN_VIEW_SUCCESS_EVENT } from '../login/login-view.types.js';

// import.meta.env.BASE_URL refleja `base` de vite.config.ts: '/' en dev/test,
// '/dashboard/' en el build de producción (servido bajo ese prefijo por
// apps/api/internal/webui) — las rutas del router de cliente tienen que
// respetarlo, o un refresco de página en producción pediría una ruta que el
// servidor nunca sirve.
const BASE_PATH = import.meta.env.BASE_URL;
const ROOT_PATH = BASE_PATH;
const LOGIN_PATH = `${BASE_PATH}login`;

class AppRoot extends BaseElement {
  private currentView: 'login' | 'private' = 'login';
  private readonly onLoginSuccess = (): void => { this.showPrivate(); };
  private readonly onSessionInvalidated = (): void => { this.showLogin(); };

  connectedCallback(): void {
    this.addEventListener(LOGIN_VIEW_SUCCESS_EVENT, this.onLoginSuccess);
    window.addEventListener(SESSION_INVALIDATED_EVENT, this.onSessionInvalidated);
    if (sessionStore.getToken()) {
      this.currentView = 'private';
      this.render();
    } else {
      this.showLogin();
    }
  }

  disconnectedCallback(): void {
    this.removeEventListener(LOGIN_VIEW_SUCCESS_EVENT, this.onLoginSuccess);
    window.removeEventListener(SESSION_INVALIDATED_EVENT, this.onSessionInvalidated);
  }

  private showLogin(): void {
    if (window.location.pathname !== LOGIN_PATH) window.history.replaceState(null, '', LOGIN_PATH);
    this.currentView = 'login';
    this.render();
  }

  private showPrivate(): void {
    if (window.location.pathname === LOGIN_PATH) window.history.pushState(null, '', ROOT_PATH);
    this.currentView = 'private';
    this.render();
  }

  private buildPrivateShell(): HTMLElement {
    const shell = document.createElement('div');
    shell.className = 'app-shell-private';
    shell.setAttribute('data-cy', 'app-shell-private');

    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'logout-action';
    logoutBtn.setAttribute('data-cy', 'dashboard-button-logout');
    logoutBtn.textContent = 'Cerrar sesión';
    logoutBtn.addEventListener('click', () => {
      sessionStore.clear();
      this.showLogin();
    });
    shell.appendChild(logoutBtn);
    shell.appendChild(document.createElement('reporting-view'));

    return shell;
  }

  protected render(): void {
    this.innerHTML = '';
    this.appendChild(this.currentView === 'login' ? document.createElement('login-view') : this.buildPrivateShell());
  }
}

customElements.define('app-root', AppRoot);

import type { AuthSectionState } from './auth-section.service.js';

export interface AuthSectionCallbacks {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenForgotPassword: () => void;
  onLogout: () => void;
}

/**
 * Construye el bloque de estado de cuenta dentro de la tarjeta de identidad
 * de Perfil (render puro, sin efectos) — mismo patrón que
 * `buildProfileHeader`: la resolución del estado (`loadAuthSectionState`,
 * con su llamada a `/api/auth/me`) vive aparte, en `auth-section.service.ts`.
 * Sin título propio ("Cuenta"): se integra visualmente bajo el avatar/nombre
 * en `profile.element.ts::buildIdentityCard`, no como sección aparte. El
 * `username` ya se muestra en la cabecera de identidad (`buildProfileHeader`)
 * y se edita desde ahí (dentro de "Editar perfil", un único punto de
 * edición) — esta sección no repite ni el texto ni un botón propio para
 * editarlo (unificar-perfil-cuenta, a petición explícita del usuario: un
 * solo botón "Editar" en la pantalla principal, no dos).
 */
export function buildAuthSection(state: AuthSectionState, callbacks: AuthSectionCallbacks): HTMLElement {
  const section = document.createElement('div');
  section.className = 'auth-section';
  section.setAttribute('data-cy', 'auth-section-cuenta');

  section.appendChild(
    state.status === 'logged-in' ? buildLoggedIn(state.email, callbacks) : buildLoggedOut(callbacks),
  );

  return section;
}

function buildLoggedIn(email: string, callbacks: AuthSectionCallbacks): HTMLElement {
  const row = document.createElement('div');
  row.className = 'auth-loggedin-row';

  const dot = document.createElement('span');
  dot.className = 'auth-status-dot';
  row.appendChild(dot);

  const emailEl = document.createElement('p');
  emailEl.className = 'auth-email';
  emailEl.textContent = email;
  row.appendChild(emailEl);

  const logoutBtn = document.createElement('button');
  logoutBtn.type = 'button';
  logoutBtn.className = 'auth-link-btn';
  logoutBtn.setAttribute('data-cy', 'auth-btn-cerrar-sesion');
  logoutBtn.textContent = 'Salir';
  logoutBtn.addEventListener('click', callbacks.onLogout);
  row.appendChild(logoutBtn);

  return row;
}

function buildLoggedOut(callbacks: AuthSectionCallbacks): HTMLElement {
  const container = document.createElement('div');
  container.appendChild(buildLoggedOutActions(callbacks));
  container.appendChild(buildForgotPasswordLink(callbacks));
  return container;
}

function buildLoggedOutActions(callbacks: AuthSectionCallbacks): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'auth-actions';

  const loginBtn = document.createElement('button');
  loginBtn.type = 'button';
  loginBtn.className = 'account-btn account-btn--primary';
  loginBtn.setAttribute('data-cy', 'auth-btn-abrir-login');
  loginBtn.textContent = 'Iniciar sesión';
  loginBtn.addEventListener('click', callbacks.onOpenLogin);
  actions.appendChild(loginBtn);

  const registerBtn = document.createElement('button');
  registerBtn.type = 'button';
  registerBtn.className = 'account-btn account-btn--ghost';
  registerBtn.setAttribute('data-cy', 'auth-btn-abrir-registro');
  registerBtn.textContent = 'Crear cuenta';
  registerBtn.addEventListener('click', callbacks.onOpenRegister);
  actions.appendChild(registerBtn);

  return actions;
}

function buildForgotPasswordLink(callbacks: AuthSectionCallbacks): HTMLElement {
  const forgotBtn = document.createElement('button');
  forgotBtn.type = 'button';
  forgotBtn.className = 'auth-forgot-link';
  forgotBtn.setAttribute('data-cy', 'auth-btn-abrir-recuperar');
  forgotBtn.textContent = '¿Olvidaste tu contraseña?';
  forgotBtn.addEventListener('click', callbacks.onOpenForgotPassword);
  return forgotBtn;
}

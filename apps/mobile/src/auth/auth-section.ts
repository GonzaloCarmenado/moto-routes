import type { AuthSectionState } from './auth-section.service.js';

export interface AuthSectionCallbacks {
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenForgotPassword: () => void;
  onLogout: () => void;
}

/**
 * Construye la sección "Cuenta" de Perfil (render puro, sin efectos) —
 * mismo patrón que `buildProfileHeader`: la resolución del estado
 * (`loadAuthSectionState`, con su llamada a `/api/auth/me`) vive aparte, en
 * `auth-section.service.ts`.
 */
export function buildAuthSection(state: AuthSectionState, callbacks: AuthSectionCallbacks): HTMLElement {
  const section = document.createElement('div');
  section.className = 'auth-section';
  section.setAttribute('data-cy', 'auth-section-cuenta');

  const title = document.createElement('h2');
  title.className = 'section-title';
  title.textContent = 'Cuenta';
  section.appendChild(title);

  section.appendChild(state.status === 'logged-in' ? buildLoggedIn(state.email, callbacks) : buildLoggedOut(callbacks));

  return section;
}

function buildLoggedIn(email: string, callbacks: AuthSectionCallbacks): HTMLElement {
  const wrapper = document.createElement('div');

  const emailEl = document.createElement('p');
  emailEl.className = 'auth-email';
  emailEl.textContent = email;
  wrapper.appendChild(emailEl);

  const logoutBtn = document.createElement('button');
  logoutBtn.type = 'button';
  logoutBtn.className = 'edit-btn';
  logoutBtn.setAttribute('data-cy', 'auth-btn-cerrar-sesion');
  logoutBtn.textContent = 'Cerrar sesión';
  logoutBtn.addEventListener('click', callbacks.onLogout);
  wrapper.appendChild(logoutBtn);

  return wrapper;
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
  loginBtn.className = 'edit-btn';
  loginBtn.setAttribute('data-cy', 'auth-btn-abrir-login');
  loginBtn.textContent = 'Iniciar sesión';
  loginBtn.addEventListener('click', callbacks.onOpenLogin);
  actions.appendChild(loginBtn);

  const registerBtn = document.createElement('button');
  registerBtn.type = 'button';
  registerBtn.className = 'edit-btn';
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

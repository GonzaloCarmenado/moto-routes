/**
 * Controlador de la sección "Cuenta" dentro de Perfil: resuelve y mantiene el
 * `AuthSectionState` y expone los manejadores de login/registro/recuperar
 * contraseña/cerrar sesión/editar username. Extraído de `profile.element.ts`
 * por el límite de líneas del proyecto (`eslint.config.js`, `max-lines`) —
 * excepción documentada al patrón de sufijos `.element`/`.transform`, no una
 * convención nueva a seguir por defecto (ver CLAUDE.md, "Extracción por
 * límite de líneas").
 */
import { loadAuthSectionState, type AuthSectionState } from '../auth/auth-section.service.js';
import { buildAuthSection } from '../auth/auth-section.js';
import { openLoginDialog } from '../auth/auth-login-dialog.element.js';
import { openRegisterDialog } from '../auth/auth-register-dialog.element.js';
import { openForgotPasswordDialog } from '../auth/auth-forgot-password-dialog.element.js';
import { openUsernameEditDialog } from '../auth/username-edit-dialog.element.js';
import { getApiBaseUrl } from '../shared/http/api-config.js';
import type { ISessionRepository } from '../shared/models/session.repository.js';
import { APP_EVENTS, dispatchAppEvent } from '../shared/app-events.js';

const EMPTY_AUTH_STATE: AuthSectionState = { status: 'logged-out' };

export interface ProfileAccountControllerOptions {
  getSessionRepository: () => ISessionRepository | null;
  onChange: () => void;
}

/** Estado de cuenta de Perfil + sus manejadores, ver JSDoc del fichero. */
export class ProfileAccountController {
  state: AuthSectionState = EMPTY_AUTH_STATE;

  constructor(private readonly options: ProfileAccountControllerOptions) {}

  async refresh(): Promise<void> {
    const sessionRepo = this.options.getSessionRepository();
    if (!sessionRepo) return;
    this.state = await loadAuthSectionState(getApiBaseUrl(), sessionRepo);
    this.options.onChange();
  }

  private async handleOpenLogin(): Promise<void> {
    const sessionRepo = this.options.getSessionRepository();
    if (!sessionRepo) return;
    const result = await openLoginDialog({ apiBaseUrl: getApiBaseUrl(), sessionRepository: sessionRepo });
    if (result === 'logged-in') {
      await this.refresh();
      // `app-root::init()` solo comprueba el bloqueo por username sin fijar (nombre-usuario,
      // design.md Decisión 3) al arrancar en frío — un login interactivo dentro de una sesión
      // de app ya abierta necesita este aviso aparte para no dejar pasar sin el bloqueo a una
      // cuenta preexistente sin username (gap real encontrado al escribir el E2E, ver tasks.md 7.2).
      dispatchAppEvent(APP_EVENTS.AUTH_LOGGED_IN);
    }
  }

  private async handleOpenRegister(): Promise<void> {
    await openRegisterDialog({ apiBaseUrl: getApiBaseUrl() });
  }

  private async handleOpenForgotPassword(): Promise<void> {
    await openForgotPasswordDialog({ apiBaseUrl: getApiBaseUrl() });
  }

  private async handleEditUsername(): Promise<void> {
    const sessionRepo = this.options.getSessionRepository();
    if (!sessionRepo) return;
    const session = await sessionRepo.get();
    if (!session) return;

    const currentUsername = this.state.status === 'logged-in' ? this.state.username : null;
    const result = await openUsernameEditDialog({ apiBaseUrl: getApiBaseUrl(), token: session.token, currentUsername });

    if (result.action === 'saved') await this.refresh();
  }

  private async handleLogout(): Promise<void> {
    const sessionRepo = this.options.getSessionRepository();
    if (!sessionRepo) return;
    await sessionRepo.clear();
    this.state = EMPTY_AUTH_STATE;
    this.options.onChange();
  }

  build(): HTMLElement {
    return buildAuthSection(this.state, {
      onOpenLogin: () => { void this.handleOpenLogin(); },
      onOpenRegister: () => { void this.handleOpenRegister(); },
      onOpenForgotPassword: () => { void this.handleOpenForgotPassword(); },
      onLogout: () => { void this.handleLogout(); },
      onEditUsername: () => { void this.handleEditUsername(); },
    });
  }
}

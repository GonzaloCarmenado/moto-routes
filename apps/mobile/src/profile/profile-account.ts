/**
 * @packageDocumentation
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
import { resolveAccountAvatarUrl } from './account-avatar-cache.js';

const EMPTY_AUTH_STATE: AuthSectionState = { status: 'logged-out' };

/** Dependencias inyectadas al construir el controlador, ver {@link ProfileAccountController}. */
export interface ProfileAccountControllerOptions {
  /** Repositorio de sesión activo, o `null` si todavía no está listo (p. ej. SQLite no inicializado). */
  getSessionRepository: () => ISessionRepository | null;
  /** Notifica al contenedor (`profile.element.ts`) que debe volver a renderizar tras un cambio de estado. */
  onChange: () => void;
}

/** Estado de cuenta de Perfil + sus manejadores, ver JSDoc del fichero. */
export class ProfileAccountController {
  state: AuthSectionState = EMPTY_AUTH_STATE;
  /**
   * Avatar de cuenta ya descargado y cacheado (ver `account-avatar-cache.ts`),
   * o `null` sin sesión activa, sin avatar configurado, o si la última
   * descarga falló (`identidad-cuenta`, ADR-055). Se resuelve aparte de
   * `state`: `user-auth` (`AuthSectionState`/`loadAuthSectionState`) no
   * cambia con este proyecto (ver proposal.md, Modified Capabilities).
   */
  avatarUrl: string | null = null;

  constructor(private readonly options: ProfileAccountControllerOptions) {}

  /** Recarga `state` y `avatarUrl` desde el backend (o los deja vacíos sin sesión) y notifica el cambio. */
  async refresh(): Promise<void> {
    const sessionRepo = this.options.getSessionRepository();
    if (!sessionRepo) return;
    this.state = await loadAuthSectionState(getApiBaseUrl(), sessionRepo);
    this.avatarUrl = await this.resolveAvatarUrl(sessionRepo);
    this.options.onChange();
  }

  private async resolveAvatarUrl(sessionRepo: ISessionRepository): Promise<string | null> {
    if (this.state.status !== 'logged-in') return null;
    const session = await sessionRepo.get();
    if (!session) return null;
    return resolveAccountAvatarUrl(getApiBaseUrl(), session.token);
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

  /**
   * Abre el diálogo compartido de edición de username (`username-edit-dialog`,
   * sin cambios — ver `unificar-perfil-cuenta`) — invocado desde dentro de
   * "Editar perfil" (`profile-edit-dialog.element.ts`), no desde un botón
   * propio en la pantalla principal: un único punto de edición de identidad,
   * a petición explícita del usuario. Devuelve el username ya actualizado si
   * se guardó, o `null` si se canceló/no hay sesión — para que el diálogo
   * que lo invoca pueda refrescar su propia previsualización.
   */
  async handleEditUsername(): Promise<string | null> {
    const sessionRepo = this.options.getSessionRepository();
    if (!sessionRepo) return null;
    const session = await sessionRepo.get();
    if (!session) return null;

    const currentUsername = this.state.status === 'logged-in' ? this.state.username : null;
    const result = await openUsernameEditDialog({ apiBaseUrl: getApiBaseUrl(), token: session.token, currentUsername });
    if (result.action !== 'saved') return null;

    await this.refresh();
    return this.state.status === 'logged-in' ? this.state.username : null;
  }

  private async handleLogout(): Promise<void> {
    const sessionRepo = this.options.getSessionRepository();
    if (!sessionRepo) return;
    await sessionRepo.clear();
    this.state = EMPTY_AUTH_STATE;
    this.avatarUrl = null;
    this.options.onChange();
  }

  /** Construye la sección "Cuenta" a partir del `state` actual, con sus manejadores ya cableados. */
  build(): HTMLElement {
    return buildAuthSection(this.state, {
      onOpenLogin: () => { void this.handleOpenLogin(); },
      onOpenRegister: () => { void this.handleOpenRegister(); },
      onOpenForgotPassword: () => { void this.handleOpenForgotPassword(); },
      onLogout: () => { void this.handleLogout(); },
    });
  }
}

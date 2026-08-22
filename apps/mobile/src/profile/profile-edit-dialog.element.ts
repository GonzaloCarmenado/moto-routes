/**
 * Web Component `<profile-edit-dialog>`: modal "Editar perfil", único punto
 * de edición de identidad de cuenta — avatar (con previsualización en vivo,
 * reutilizando `buildProfileHeader`, y su propio menú Cámara/Galería sobre
 * las funciones del adapter compartido) y username (delegado en el diálogo
 * ya existente `username-edit-dialog.element.ts`, sin cambios, solo
 * invocado desde aquí en vez de desde un botón propio en la pantalla
 * principal de Perfil — a petición explícita del usuario: un solo botón
 * "Editar" visible, no dos con el mismo texto).
 *
 * El guardado del avatar ocurre *dentro* del flujo del diálogo: recibe un
 * callback `onSave` en vez de devolver los datos crudos, para poder
 * mantenerse abierto mostrando el error de AC-012 sin que el llamador tenga
 * que volver a abrirlo. El username, en cambio, se guarda de inmediato
 * dentro de `username-edit-dialog` (igual que ya hacía antes de moverse
 * aquí) — cancelar este diálogo con "Cancelar"/ESC/overlay solo descarta la
 * foto elegida, nunca deshace un cambio de username ya guardado.
 * Reutiliza el patrón overlay/`trapFocus` de `confirm-dialog.element.ts`, con
 * `closable: true`.
 */
import { BaseElement } from '../shared/base-element.js';
import { buildProfileHeader } from './profile-header.js';
import { captureFromCamera, pickFromGallery, validatePhoto } from '../shared/services/photo-capture-adapter.service.js';
import { showToast } from '../shared/feedback/toast.js';
import styles from './profile-edit-dialog.element.css?inline';

/** Resultado pasado al callback de guardado inyectado por el llamador. */
export interface ProfileEditSaveResult {
  /** Archivo de avatar recién elegido por el usuario, ya validado (formato/tamaño). */
  avatarFile: File;
}

/** Opciones para abrir el modal "Editar perfil". */
export interface ProfileEditDialogOptions {
  /** URL ya resuelta del avatar actual de la cuenta, o `null` si todavía no hay ninguno configurado. */
  avatarUrl: string | null;
  /** `username` de la cuenta autenticada, mostrado en la previsualización. */
  username: string | null;
  /**
   * Invocado al pulsar "Guardar" con el archivo elegido. Si la promesa
   * rechaza (p. ej. subida fallida), el modal permanece abierto mostrando un
   * toast de error y conservando la previsualización elegida (AC-012), en
   * vez de cerrarse.
   */
  onSave: (result: ProfileEditSaveResult) => Promise<void>;
  /**
   * Invocado al pulsar "Editar username"/"Fijar username": abre
   * `username-edit-dialog` y devuelve el username ya actualizado si se
   * guardó, o `null` si se canceló — para que la previsualización de este
   * diálogo se actualice sin cerrarlo.
   */
  onEditUsername: () => Promise<string | null>;
}

class ProfileEditDialogElement extends BaseElement {
  private options: ProfileEditDialogOptions | null = null;
  private onResolve: ((value: 'saved' | 'cancelled') => void) | null = null;
  private previouslyFocused: HTMLElement | null = null;

  /** Foto recién elegida en el modal, todavía no subida al servidor. */
  private avatarFile: File | null = null;
  /** URL mostrada en la previsualización: la del avatar actual, o el `blob:` de la foto recién elegida. */
  private previewUrl: string | null = null;
  /** Username mostrado en la previsualización — separado de `options.username` para poder actualizarse tras editarlo sin cerrar este diálogo. */
  private currentUsername: string | null = null;
  /** `true` mientras `handleEditUsername()` está en curso (el diálogo anidado ya tiene su propio spinner/estado, esto solo deshabilita el botón que lo abre). */
  private editingUsername = false;
  /** `blob:` URL creada por este diálogo (si la hay), para liberarla al cerrar. */
  private createdObjectUrl: string | null = null;
  /**
   * `true` mientras `handleSave()` está subiendo la foto al servidor —
   * subir una foto grande puede tardar perceptiblemente (AC-042); sin
   * indicador visual, la UI parece colgada entre el click en "Guardar" y el
   * cierre del modal.
   */
  private saving = false;

  private menuEl: HTMLElement | null = null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Tab') {
      this.trapFocus(event);
      return;
    }
    if (event.key !== 'Escape' || this.saving) return;
    this.close('cancelled');
  };

  /** Ciclo de foco: Cambiar foto → Cancelar → Guardar, y viceversa con Shift+Tab. */
  private trapFocus(event: KeyboardEvent): void {
    const root = this.shadowRoot;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>('[data-cy="profile-btn-cambiar-foto"], [data-cy="profile-btn-editar-username"], .action'),
    );
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = root.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    document.addEventListener('keydown', this.onKeyDown);
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  /** Abre el diálogo con las opciones dadas y devuelve una promesa con `'saved'`/`'cancelled'`. */
  open(options: ProfileEditDialogOptions): Promise<'saved' | 'cancelled'> {
    this.options = options;
    this.previewUrl = options.avatarUrl;
    this.currentUsername = options.username;
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.render();
    return new Promise((resolve) => { this.onResolve = resolve; });
  }

  private close(result: 'saved' | 'cancelled'): void {
    // Higiene de memoria: liberar cualquier blob: URL de previsualización creada localmente.
    if (this.createdObjectUrl) {
      URL.revokeObjectURL(this.createdObjectUrl);
      this.createdObjectUrl = null;
    }
    this.onResolve?.(result);
    this.onResolve = null;
    this.previouslyFocused?.focus();
    this.remove();
  }

  private toggleMenu(): void {
    this.menuEl?.classList.toggle('menu-open');
  }

  private closeMenu(): void {
    this.menuEl?.classList.remove('menu-open');
  }

  /** Aplica una foto recién elegida (cámara o galería) a la previsualización, sin subirla todavía (AC-007). */
  private applyChosenPhoto(file: File): void {
    const validationError = validatePhoto(file);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }
    if (this.createdObjectUrl) {
      URL.revokeObjectURL(this.createdObjectUrl);
    }
    const url = URL.createObjectURL(file);
    this.avatarFile = file;
    this.previewUrl = url;
    this.createdObjectUrl = url;
    this.render();
  }

  private async handleCameraSource(): Promise<void> {
    const file = await captureFromCamera();
    if (file) this.applyChosenPhoto(file);
  }

  private async handleGallerySource(): Promise<void> {
    const files = await pickFromGallery();
    const file = files[0];
    if (file) this.applyChosenPhoto(file);
  }

  /** Guarda: delega la subida en `onSave` (AC-009, AC-012). Deshabilitado hasta elegir una foto nueva — no hay nada más que editar aquí. */
  private async handleSave(): Promise<void> {
    if (!this.options || this.saving || !this.avatarFile) return;
    this.saving = true;
    this.render();
    try {
      await this.options.onSave({ avatarFile: this.avatarFile });
      this.close('saved');
    } catch {
      this.saving = false;
      this.render();
      showToast('No se pudo subir la foto de perfil. Inténtalo de nuevo.', 'error');
    }
  }

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.setAttribute('data-cy', 'profile-edit-dialog-overlay');
    overlay.addEventListener('click', () => { if (!this.saving) this.close('cancelled'); });
    return overlay;
  }

  private buildPreview(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'preview';
    container.appendChild(buildProfileHeader({ avatarUrl: this.previewUrl, name: this.currentUsername }));
    return container;
  }

  /** Abre `username-edit-dialog` (sin cambios) y actualiza la previsualización si se guardó, sin cerrar este diálogo. */
  private async handleEditUsername(): Promise<void> {
    if (!this.options || this.editingUsername) return;
    this.editingUsername = true;
    this.render();
    const updated = await this.options.onEditUsername();
    this.editingUsername = false;
    if (updated !== null) this.currentUsername = updated;
    this.render();
  }

  private buildUsernameControl(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'username-control';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'username-edit-btn';
    btn.setAttribute('data-cy', 'profile-btn-editar-username');
    btn.textContent = this.currentUsername ? 'Editar nombre de usuario' : 'Fijar nombre de usuario';
    btn.disabled = this.saving || this.editingUsername;
    btn.addEventListener('click', () => { void this.handleEditUsername(); });
    wrapper.appendChild(btn);

    return wrapper;
  }

  private buildChangePhotoControl(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'change-photo';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'change-photo-btn';
    btn.setAttribute('data-cy', 'profile-btn-cambiar-foto');
    btn.textContent = 'Cambiar foto';
    btn.disabled = this.saving;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.toggleMenu();
    });
    wrapper.appendChild(btn);
    wrapper.appendChild(this.buildPhotoMenu());

    return wrapper;
  }

  private buildPhotoMenu(): HTMLElement {
    const menu = document.createElement('div');
    menu.className = 'photo-menu';

    const cameraBtn = document.createElement('button');
    cameraBtn.type = 'button';
    cameraBtn.className = 'menu-item';
    cameraBtn.setAttribute('data-cy', 'profile-menu-camara');
    cameraBtn.textContent = 'Cámara';
    cameraBtn.addEventListener('click', () => {
      this.closeMenu();
      void this.handleCameraSource();
    });
    menu.appendChild(cameraBtn);

    const galleryBtn = document.createElement('button');
    galleryBtn.type = 'button';
    galleryBtn.className = 'menu-item';
    galleryBtn.setAttribute('data-cy', 'profile-menu-galeria');
    galleryBtn.textContent = 'Galería';
    galleryBtn.addEventListener('click', () => {
      this.closeMenu();
      void this.handleGallerySource();
    });
    menu.appendChild(galleryBtn);

    this.menuEl = menu;
    return menu;
  }

  private buildActions(): HTMLElement {
    const actions = document.createElement('div');
    actions.className = 'actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'action action--danger';
    cancelBtn.setAttribute('data-cy', 'profile-btn-cancelar-perfil');
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.disabled = this.saving;
    cancelBtn.addEventListener('click', () => { this.close('cancelled'); });
    actions.appendChild(cancelBtn);

    actions.appendChild(this.buildSaveButton());

    return actions;
  }

  /** Botón "Guardar": deshabilitado sin foto nueva elegida, o mientras `handleSave()` está en curso (AC-042). */
  private buildSaveButton(): HTMLButtonElement {
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'action action--primary';
    if (this.saving) saveBtn.classList.add('is-saving');
    saveBtn.setAttribute('data-cy', 'profile-btn-guardar-perfil');
    saveBtn.disabled = this.saving || !this.avatarFile;
    saveBtn.setAttribute('aria-busy', this.saving ? 'true' : 'false');
    if (this.saving) {
      saveBtn.setAttribute('aria-label', 'Guardando…');
      const spinner = document.createElement('span');
      spinner.className = 'spinner';
      spinner.setAttribute('aria-hidden', 'true');
      saveBtn.appendChild(spinner);
    } else {
      saveBtn.textContent = 'Guardar';
    }
    saveBtn.addEventListener('click', () => { void this.handleSave(); });
    return saveBtn;
  }

  private buildDialog(): HTMLElement {
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const titleEl = document.createElement('h2');
    titleEl.className = 'title';
    titleEl.textContent = 'Editar perfil';
    dialog.appendChild(titleEl);

    dialog.appendChild(this.buildPreview());
    dialog.appendChild(this.buildChangePhotoControl());
    dialog.appendChild(this.buildUsernameControl());
    dialog.appendChild(this.buildActions());

    return dialog;
  }

  protected render(): void {
    if (!this.options) return;
    this.renderShadow(styles, this.buildOverlay(), this.buildDialog());
  }
}

customElements.define('profile-edit-dialog', ProfileEditDialogElement);

/**
 * Abre un `<profile-edit-dialog>` montado en `document.body` y devuelve una
 * promesa con `'saved'` (tras un `onSave` resuelto con éxito) o
 * `'cancelled'` (Cancelar/ESC/overlay). El elemento se autodestruye al
 * resolver.
 */
export function openProfileEditDialog(options: ProfileEditDialogOptions): Promise<'saved' | 'cancelled'> {
  const el = document.createElement('profile-edit-dialog') as ProfileEditDialogElement;
  document.body.appendChild(el);
  return el.open(options);
}

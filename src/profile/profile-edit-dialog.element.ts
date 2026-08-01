/**
 * Web Component `<profile-edit-dialog>`: modal "Editar perfil" que combina
 * previsualización en vivo (reutilizando `buildProfileHeader` del Paso 9),
 * campo de nombre y control "Cambiar foto" con su propio menú Cámara/Galería
 * sobre las funciones del adapter compartido — nunca reutiliza la instancia
 * del Web Component `<photo-capture>` (ver decisión de diseño #4 del plan).
 *
 * A diferencia de `openSaveRouteDialog`, el guardado real ocurre *dentro*
 * del flujo del diálogo: recibe un callback `onSave` en vez de devolver los
 * datos crudos, precisamente para poder mantenerse abierto mostrando el
 * error de AC-012 sin que el llamador tenga que volver a abrirlo. Reutiliza
 * el patrón overlay/`trapFocus` de `confirm-dialog.element.ts`, con
 * `closable: true` (a diferencia de `cockpit-save-route-dialog`, este modal
 * sí es cerrable con ESC/overlay).
 */
import { BaseElement } from '../shared/base-element.js';
import { buildProfileHeader } from './profile-header.js';
import { captureFromCamera, pickFromGallery, validatePhoto } from '../shared/services/photo-capture-adapter.service.js';
import { savePhotoFile } from '../shared/services/photo-storage.service.js';
import { showToast } from '../shared/feedback/toast.js';
import styles from './profile-edit-dialog.element.css?inline';

/** Resultado pasado al callback de guardado inyectado por el llamador. */
export interface ProfileEditSaveResult {
  /** Ruta ya persistida en disco de la nueva foto (tras `savePhotoFile`), o `null` si el usuario no cambió la foto (señal de "no cambiar" para el llamador). */
  avatarPath: string | null;
  /** Nombre tal cual escrito, sin trim — el saneado (`sanitizeProfileName`) es responsabilidad del llamador. */
  name: string;
}

/** Opciones para abrir el modal "Editar perfil". */
export interface ProfileEditDialogOptions {
  /** URL ya resuelta del avatar actual, o `null` si todavía no hay ninguno configurado. */
  avatarUrl: string | null;
  /** Nombre guardado actual, o `null` si todavía no hay ninguno configurado. */
  name: string | null;
  /**
   * Invocado al pulsar "Guardar" con los datos recogidos en el modal. Si la
   * promesa rechaza (p. ej. fallo de persistencia), el modal permanece
   * abierto mostrando un toast de error y conservando los valores
   * introducidos (AC-012), en vez de cerrarse.
   */
  onSave: (result: ProfileEditSaveResult) => Promise<void>;
}

class ProfileEditDialogElement extends BaseElement {
  private options: ProfileEditDialogOptions | null = null;
  private onResolve: ((value: 'saved' | 'cancelled') => void) | null = null;
  private previouslyFocused: HTMLElement | null = null;

  /** Foto recién elegida en el modal, todavía no escrita a disco (decisión de diseño #5). */
  private avatarFile: File | null = null;
  /** URL mostrada en la previsualización: la del avatar actual, o el `blob:` de la foto recién elegida. */
  private previewUrl: string | null = null;
  /** `blob:` URL creada por este diálogo (si la hay), para liberarla al cerrar. */
  private createdObjectUrl: string | null = null;

  private previewContainer: HTMLElement | null = null;
  private nameInput: HTMLInputElement | null = null;
  private menuEl: HTMLElement | null = null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Tab') {
      this.trapFocus(event);
      return;
    }
    if (event.key !== 'Escape') return;
    this.close('cancelled');
  };

  /** Ciclo de foco: input → Cambiar foto → Cancelar → Guardar → (Tab) vuelve al input, y viceversa con Shift+Tab. */
  private trapFocus(event: KeyboardEvent): void {
    const root = this.shadowRoot;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>(
        '[data-cy="profile-input-nombre"], [data-cy="profile-btn-cambiar-foto"], .action',
      ),
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
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.render();
    this.nameInput?.focus();
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

  private getCurrentName(): string | null {
    return this.nameInput ? this.nameInput.value : (this.options?.name ?? null);
  }

  private updatePreview(): void {
    if (!this.previewContainer) return;
    this.previewContainer.innerHTML = '';
    this.previewContainer.appendChild(
      buildProfileHeader({ avatarUrl: this.previewUrl, name: this.getCurrentName() }),
    );
  }

  private toggleMenu(): void {
    this.menuEl?.classList.toggle('menu-open');
  }

  private closeMenu(): void {
    this.menuEl?.classList.remove('menu-open');
  }

  /** Aplica una foto recién elegida (cámara o galería) a la previsualización, sin tocar disco todavía (AC-007). */
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
    this.updatePreview();
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

  /** Guarda: escribe la foto a disco (si se cambió) y delega la persistencia en `onSave` (AC-009, AC-012). */
  private async handleSave(): Promise<void> {
    if (!this.options) return;
    try {
      const avatarPath = this.avatarFile ? await savePhotoFile(this.avatarFile) : null;
      const name = this.nameInput?.value ?? '';
      await this.options.onSave({ avatarPath, name });
      this.close('saved');
    } catch {
      showToast('No se pudo guardar el perfil. Inténtalo de nuevo.', 'error');
    }
  }

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.setAttribute('data-cy', 'profile-edit-dialog-overlay');
    overlay.addEventListener('click', () => { this.close('cancelled'); });
    return overlay;
  }

  private buildPreview(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'preview';
    container.appendChild(buildProfileHeader({ avatarUrl: this.previewUrl, name: this.getCurrentName() }));
    this.previewContainer = container;
    return container;
  }

  private buildChangePhotoControl(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'change-photo';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'change-photo-btn';
    btn.setAttribute('data-cy', 'profile-btn-cambiar-foto');
    btn.textContent = 'Cambiar foto';
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

  private buildNameField(): HTMLElement {
    const field = document.createElement('div');
    field.className = 'field';

    const label = document.createElement('label');
    label.className = 'field-label';
    label.textContent = 'Nombre';
    label.setAttribute('for', 'profile-edit-name-input');
    field.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'profile-edit-name-input';
    input.className = 'input';
    input.setAttribute('data-cy', 'profile-input-nombre');
    input.setAttribute('maxlength', '100');
    input.setAttribute('aria-label', 'Nombre');
    input.value = this.options?.name ?? '';
    input.addEventListener('input', () => { this.updatePreview(); });
    this.nameInput = input;
    field.appendChild(input);

    return field;
  }

  private buildActions(): HTMLElement {
    const actions = document.createElement('div');
    actions.className = 'actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'action action--danger';
    cancelBtn.setAttribute('data-cy', 'profile-btn-cancelar-perfil');
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.addEventListener('click', () => { this.close('cancelled'); });
    actions.appendChild(cancelBtn);

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'action action--primary';
    saveBtn.setAttribute('data-cy', 'profile-btn-guardar-perfil');
    saveBtn.textContent = 'Guardar';
    saveBtn.addEventListener('click', () => { void this.handleSave(); });
    actions.appendChild(saveBtn);

    return actions;
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
    dialog.appendChild(this.buildNameField());
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

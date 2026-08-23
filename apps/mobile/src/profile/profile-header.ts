/**
 * Constructor de DOM compartido para el bloque visual "avatar circular +
 * nombre" del perfil (AC-001, AC-002, AC-003, AC-005): usado tanto por la
 * vista principal (`profile.element.ts`) como por la previsualización en
 * vivo del modal de edición (`profile-edit-dialog.element.ts`), para
 * garantizar por diseño — no por convención verbal — que ambos renderizan
 * exactamente el mismo layout, sin duplicar HTML ni lógica.
 *
 * Construido exclusivamente con `createElement`/`createElementNS` +
 * `appendChild`, nunca `innerHTML` (frontend-conventions.md §8: rendimiento
 * y superficie de XSS). No importa `photo-storage.service.ts` ni resuelve
 * la URL del avatar por sí mismo — recibe `avatarUrl` ya resuelto por quien
 * lo llame.
 */
import { buildAvatarPlaceholder } from '../shared/icons/avatar-placeholder-icon.js';

/** Opciones para construir el bloque avatar+nombre. */
export interface ProfileHeaderOptions {
  /** URL ya resuelta de la foto de perfil (`blob:`, ruta de archivo, etc.), o `null` si todavía no se ha configurado ninguna (AC-002). */
  avatarUrl: string | null;
  /**
   * El `username` de la cuenta autenticada, o `null` sin sesión activa —
   * sin marcador de posición propio: sin sesión, no se muestra ningún
   * nombre (`unificar-perfil-cuenta`, ADR-055).
   */
  name: string | null;
  /** Invocado al pulsar el avatar (p. ej. para abrir el modal de edición). Opcional: sin callback, el click no hace nada ni lanza error. */
  onAvatarClick?: () => void;
}

/**
 * Construye el bloque "avatar circular + nombre" reutilizado tal cual por
 * la vista principal y la previsualización en vivo del modal de edición
 * (AC-005), garantizando el mismo layout en ambos sitios por diseño.
 * @param options - Datos ya resueltos para renderizar (avatar, nombre, callback opcional de click).
 * @returns El elemento raíz `.profile-header`, listo para insertarse en el DOM.
 */
export function buildProfileHeader(options: ProfileHeaderOptions): HTMLElement {
  const { avatarUrl, name, onAvatarClick } = options;

  const header = document.createElement('div');
  header.className = 'profile-header';
  header.appendChild(buildAvatarButton(avatarUrl, onAvatarClick));
  header.appendChild(buildNameElement(name));

  return header;
}

/**
 * Botón tocable del avatar (AC-004, AC-038: hitbox mínima vía la clase
 * `.avatar`, aplicada en `profile.element.css`). Contiene la foto o el
 * placeholder según `avatarUrl`.
 */
function buildAvatarButton(avatarUrl: string | null, onAvatarClick?: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'avatar';
  button.setAttribute('data-cy', 'profile-avatar-editar');
  button.setAttribute('aria-label', 'Editar foto de perfil');
  button.appendChild(avatarUrl ? buildAvatarImage(avatarUrl) : buildAvatarPlaceholder());

  if (onAvatarClick) {
    button.addEventListener('click', onAvatarClick);
  }

  return button;
}

/** Foto de perfil ya elegida (AC-001): el recorte circular lo aplica la clase `.avatar-image` vía CSS (`border-radius: 50%` + `object-fit: cover`), no aquí. */
function buildAvatarImage(avatarUrl: string): HTMLImageElement {
  const img = document.createElement('img');
  img.className = 'avatar-image';
  img.src = avatarUrl;
  img.alt = '';
  return img;
}

/** Nombre a mostrar (el `username` de la cuenta) — vacío sin sesión activa, sin marcador de posición propio. */
function buildNameElement(name: string | null): HTMLParagraphElement {
  const nameEl = document.createElement('p');
  nameEl.className = 'profile-name';
  nameEl.setAttribute('data-cy', 'profile-name');
  nameEl.textContent = name ?? '';
  return nameEl;
}

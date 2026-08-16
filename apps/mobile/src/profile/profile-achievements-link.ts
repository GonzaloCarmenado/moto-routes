/**
 * Fila de acceso a "Mis logros" (sistema-logros) desde el perfil — icono +
 * etiqueta + chevron, misma altura de fila que un ajuste de cuenta. Extraído
 * de `profile.element.ts` para no superar el límite de líneas del fichero
 * (`eslint.config.js`, `max-lines`), mismo patrón de extracción ya usado en
 * el propio dominio (`profile-header.ts`).
 *
 * Rediseñado tras verificación en dispositivo real: la primera versión era
 * un botón de solo texto al final de la pantalla, "perdido" y sin icono —
 * ahora es una fila propia justo debajo de la tarjeta de identidad, con el
 * mismo icono de logro que usa `achievement-list.element.ts`.
 */
import { APP_EVENTS, dispatchAppEvent } from '../shared/app-events.js';
import { ACHIEVEMENT_PLACEHOLDER_ICON } from '../shared/icons/achievement-icons.js';

const CHEVRON_ICON = '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>';

/** Construye la fila "Mis logros", disponible con o sin sesión — la propia pantalla decide qué mostrar. */
export function buildAchievementsLink(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'achievements-link';
  btn.setAttribute('data-cy', 'profile-btn-mis-logros');
  btn.addEventListener('click', () => { dispatchAppEvent(APP_EVENTS.VIEW_ACHIEVEMENTS); });
  btn.append(buildIcon(), buildLabel(), buildChevron());
  return btn;
}

function buildIcon(): HTMLElement {
  const icon = document.createElement('span');
  icon.className = 'achievements-link__icon';
  icon.innerHTML = ACHIEVEMENT_PLACEHOLDER_ICON;
  return icon;
}

function buildLabel(): HTMLElement {
  const label = document.createElement('span');
  label.className = 'achievements-link__label';
  label.textContent = 'Mis logros';
  return label;
}

function buildChevron(): HTMLElement {
  const chevron = document.createElement('span');
  chevron.className = 'achievements-link__chevron';
  chevron.innerHTML = CHEVRON_ICON;
  return chevron;
}

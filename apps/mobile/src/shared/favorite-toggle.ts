/**
 * Icono/botón de favorito, compartido entre `route-list` (por card) y
 * `route-detail` — pura construcción de DOM, sin persistencia: cada llamador
 * hace su propio `updateFavorite()` + `triggerAutoResync()` en `onToggle`.
 * El indicador de lectura (relleno si `isFavorite`) se muestra siempre, con
 * su propio `data-cy` (localizable por un test aunque no sea interactivo,
 * regla del proyecto); solo es un elemento `<button>` con listener cuando
 * hay sesión activa — sin sesión, se renderiza como `<span>` no interactivo
 * (favoritos-rutas, design.md D5).
 */
import { FAVORITE_ICON } from './icons/favorite-icons.js';

export interface FavoriteToggleOptions {
  isFavorite: boolean;
  /** `null` sin sesión activa: renderiza en modo solo lectura, sin acción táctil. */
  onToggle: (() => void) | null;
  dataCy: string;
}

/** Construye el icono/botón de favorito según `options` (ver JSDoc del módulo). */
export function buildFavoriteToggle(options: FavoriteToggleOptions): HTMLElement {
  const { isFavorite, onToggle, dataCy } = options;
  const el = document.createElement(onToggle ? 'button' : 'span');
  el.className = 'favorite-icon';
  el.classList.toggle('favorite-icon--active', isFavorite);
  el.setAttribute('data-cy', dataCy);
  el.innerHTML = FAVORITE_ICON;

  if (onToggle) {
    const btn = el as HTMLButtonElement;
    btn.type = 'button';
    btn.setAttribute('aria-label', isFavorite ? 'Quitar de favoritas' : 'Marcar como favorita');
    btn.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      onToggle();
    });
  } else {
    el.setAttribute('aria-label', isFavorite ? 'Ruta favorita' : 'Ruta no favorita');
  }

  return el;
}

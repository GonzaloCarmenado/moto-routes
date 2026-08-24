/**
 * Icono SVG placeholder de avatar (silueta de persona, trazo 2px sin
 * relleno complejo — `design-system.md` §9), construido con
 * `createElementNS` (nunca `innerHTML`, ver `profile-header.ts`). Extraído
 * a `shared/` porque lo consumen dos dominios distintos: el perfil propio
 * (`profile-header.ts`) y el selector de amigos (`friend-selector.element.ts`,
 * ver `selector-amigos`) — antes vivía solo en `profile/`, pero
 * `shared/` no puede importar de un dominio, así que se promueve aquí.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

const AVATAR_PLACEHOLDER_ICON = {
  headCx: '12',
  headCy: '8',
  headR: '4',
  shouldersPath: 'M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8',
} as const;

/** Construye el icono de silueta placeholder cuando no hay avatar configurado/disponible. */
export function buildAvatarPlaceholder(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('data-cy', 'profile-avatar-placeholder');
  svg.classList.add('avatar-placeholder');

  const head = document.createElementNS(SVG_NS, 'circle');
  head.setAttribute('cx', AVATAR_PLACEHOLDER_ICON.headCx);
  head.setAttribute('cy', AVATAR_PLACEHOLDER_ICON.headCy);
  head.setAttribute('r', AVATAR_PLACEHOLDER_ICON.headR);
  svg.appendChild(head);

  const shoulders = document.createElementNS(SVG_NS, 'path');
  shoulders.setAttribute('d', AVATAR_PLACEHOLDER_ICON.shouldersPath);
  svg.appendChild(shoulders);

  return svg;
}

/**
 * @packageDocumentation
 * Animación de "logro desbloqueado" (título+descripción+icono), montada en
 * document.body. Varios logros desbloqueados a la vez se muestran en cola,
 * uno completo tras otro — nunca se solapan (ver spec "Varios logros a la
 * vez" de sistema-logros).
 */
import { BaseElement } from '../base-element.js';
import type { Achievement } from '../models/achievement.types.js';
import { ACHIEVEMENT_PLACEHOLDER_ICON } from '../icons/achievement-icons.js';
import styles from './achievement-unlock-overlay.element.css?inline';

/** Tiempo que se muestra cada logro antes de pasar al siguiente de la cola. */
const DISPLAY_MS = 4000;

const queue: Achievement[] = [];
let activeElement: AchievementUnlockOverlayElement | null = null;

class AchievementUnlockOverlayElement extends BaseElement {
  private achievement: Achievement | null = null;
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  /** Muestra este logro y programa su cierre automático. */
  show(achievement: Achievement): void {
    this.achievement = achievement;
    this.render();
    this.dismissTimer = setTimeout(() => {
      this.dismiss();
    }, DISPLAY_MS);
  }

  private dismiss(): void {
    if (this.dismissTimer) clearTimeout(this.dismissTimer);
    this.remove();
    activeElement = null;
    advanceQueue();
  }

  private buildIcon(): HTMLElement {
    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.setAttribute('data-cy', 'achievement-unlock-icon');
    icon.innerHTML = ACHIEVEMENT_PLACEHOLDER_ICON;
    return icon;
  }

  private buildText(achievement: Achievement): HTMLElement[] {
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'Logro desbloqueado';

    const title = document.createElement('h2');
    title.className = 'title';
    title.setAttribute('data-cy', 'achievement-unlock-title');
    title.textContent = achievement.title;

    const description = document.createElement('p');
    description.className = 'description';
    description.setAttribute('data-cy', 'achievement-unlock-description');
    description.textContent = achievement.description;

    return [eyebrow, title, description];
  }

  private buildDismissButton(): HTMLElement {
    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'dismiss';
    dismissBtn.setAttribute('data-cy', 'achievement-unlock-dismiss');
    dismissBtn.textContent = 'Continuar';
    dismissBtn.addEventListener('click', () => {
      this.dismiss();
    });
    return dismissBtn;
  }

  private buildCard(achievement: Achievement): HTMLElement {
    const card = document.createElement('div');
    card.className = 'card';
    card.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    card.append(this.buildIcon(), ...this.buildText(achievement), this.buildDismissButton());
    return card;
  }

  private buildOverlay(achievement: Achievement): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.setAttribute('data-cy', 'achievement-unlock-overlay');
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.addEventListener('click', () => {
      this.dismiss();
    });
    overlay.appendChild(this.buildCard(achievement));
    return overlay;
  }

  protected render(): void {
    if (!this.achievement) return;
    this.renderShadow(styles, this.buildOverlay(this.achievement));
  }
}

customElements.define('achievement-unlock-overlay', AchievementUnlockOverlayElement);

function advanceQueue(): void {
  if (activeElement) return;
  const next = queue.shift();
  if (!next) return;
  const el = document.createElement('achievement-unlock-overlay') as AchievementUnlockOverlayElement;
  document.body.appendChild(el);
  activeElement = el;
  el.show(next);
}

/**
 * Encola un logro para mostrar su animación de desbloqueo. Si ya hay una
 * visible, este se muestra en cuanto la anterior se cierra.
 */
export function enqueueAchievementUnlock(achievement: Achievement): void {
  queue.push(achievement);
  advanceQueue();
}

/** Solo para tests: vacía la cola y descarta el elemento activo entre casos. */
export function resetAchievementUnlockQueueForTests(): void {
  queue.length = 0;
  activeElement?.remove();
  activeElement = null;
}

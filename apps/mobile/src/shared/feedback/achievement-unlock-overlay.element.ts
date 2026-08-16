/**
 * @packageDocumentation
 * Animación de "logro desbloqueado" (título+descripción+icono), montada en
 * document.body. Varios logros desbloqueados a la vez se muestran en cola,
 * uno completo tras otro — nunca se solapan (ver spec "Varios logros a la
 * vez" de sistema-logros). Atrapa el foco de teclado y se cierra con Escape,
 * mismo patrón ya usado en `confirm-dialog.element.ts` (ver design.md
 * Decisión 3 de auditoria-tecnica-2026-08).
 */
import { BaseElement } from '../base-element.js';
import type { Achievement } from '../models/achievement.types.js';
import { achievementIconFor } from '../icons/achievement-icons.js';
import styles from './achievement-unlock-overlay.element.css?inline';

/** Tiempo que se muestra cada logro antes de pasar al siguiente de la cola. */
const DISPLAY_MS = 4000;

const queue: Achievement[] = [];
let activeElement: AchievementUnlockOverlayElement | null = null;

class AchievementUnlockOverlayElement extends BaseElement {
  private achievement: Achievement | null = null;
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private previouslyFocused: HTMLElement | null = null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Tab') {
      this.trapFocus(event);
      return;
    }
    if (event.key !== 'Escape') return;
    this.dismiss();
  };

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

  /** Muestra este logro, atrapa el foco dentro del overlay y programa su cierre automático. */
  show(achievement: Achievement): void {
    this.achievement = achievement;
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.render();
    this.shadowRoot?.querySelector<HTMLButtonElement>('.dismiss')?.focus();
    this.dismissTimer = setTimeout(() => {
      this.dismiss();
    }, DISPLAY_MS);
  }

  /** Tab desde el último elemento enfocable vuelve al primero, y viceversa con Shift+Tab — el foco nunca sale del overlay mientras está visible. */
  private trapFocus(event: KeyboardEvent): void {
    const focusable = Array.from(this.shadowRoot?.querySelectorAll<HTMLButtonElement>('.dismiss') ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = this.shadowRoot?.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private dismiss(): void {
    if (this.dismissTimer) clearTimeout(this.dismissTimer);
    this.previouslyFocused?.focus();
    this.remove();
    activeElement = null;
    advanceQueue();
  }

  private buildIcon(achievement: Achievement): HTMLElement {
    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.setAttribute('data-cy', 'achievement-unlock-icon');
    icon.innerHTML = achievementIconFor(achievement.requirementType);
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
    card.append(this.buildIcon(achievement), ...this.buildText(achievement), this.buildDismissButton());
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

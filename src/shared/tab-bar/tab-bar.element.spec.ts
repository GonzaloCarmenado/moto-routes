import { describe, it, expect, afterEach } from 'vitest';
import './tab-bar.element.js';

interface Tab {
  id: string;
  label: string;
}

type TabBarEl = HTMLElement & { tabs: Tab[] };

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(tabs: Tab[]): { el: TabBarEl; panelA: HTMLDivElement; panelB: HTMLDivElement } {
  const el = document.createElement('tab-bar') as TabBarEl;
  const panelA = document.createElement('div');
  panelA.setAttribute('slot', 'a');
  panelA.textContent = 'Panel A';
  const panelB = document.createElement('div');
  panelB.setAttribute('slot', 'b');
  panelB.textContent = 'Panel B';
  el.appendChild(panelA);
  el.appendChild(panelB);
  document.body.appendChild(el);
  el.tabs = tabs;
  return { el, panelA, panelB };
}

function isVisible(panel: HTMLElement | null): boolean {
  return panel?.classList.contains('tab-bar__panel--active') ?? false;
}

describe('tab-bar', () => {
  const tabs: Tab[] = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ];

  it('activates the first tab by default, showing its panel and hiding the rest (AC-002)', () => {
    const { el } = mount(tabs);
    const root = el.shadowRoot!;
    const panels = root.querySelectorAll<HTMLElement>('.tab-bar__panel');
    expect(panels).toHaveLength(2);
    expect(isVisible(panels[0]!)).toBe(true);
    expect(isVisible(panels[1]!)).toBe(false);
  });

  it('switches the visible panel when a different tab button is clicked, only one visible at a time (AC-002, AC-026)', () => {
    const { el } = mount(tabs);
    const root = el.shadowRoot!;
    const btnB = root.querySelector<HTMLButtonElement>('[data-cy="tab-bar-btn-b"]')!;
    btnB.click();

    const panels = root.querySelectorAll<HTMLElement>('.tab-bar__panel');
    expect(isVisible(panels[0]!)).toBe(false);
    expect(isVisible(panels[1]!)).toBe(true);

    const activePanels = Array.from(panels).filter((p) => p.classList.contains('tab-bar__panel--active'));
    expect(activePanels).toHaveLength(1);
  });

  it('does not destroy inactive panels light-DOM nodes when switching tabs (AC-002)', () => {
    const { el, panelA, panelB } = mount(tabs);
    const root = el.shadowRoot!;
    const btnB = root.querySelector<HTMLButtonElement>('[data-cy="tab-bar-btn-b"]')!;
    btnB.click();

    // Same light-DOM node references remain children of the host, untouched.
    expect(el.contains(panelA)).toBe(true);
    expect(el.contains(panelB)).toBe(true);
    expect(panelA.textContent).toBe('Panel A');
    expect(panelB.textContent).toBe('Panel B');

    const btnA = root.querySelector<HTMLButtonElement>('[data-cy="tab-bar-btn-a"]')!;
    btnA.click();
    expect(el.contains(panelA)).toBe(true);
    expect(el.contains(panelB)).toBe(true);
  });

  it('sets role="tablist"/"tab" and aria-selected only on the active button (AC-003)', () => {
    const { el } = mount(tabs);
    const root = el.shadowRoot!;
    const tablist = root.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();

    const buttons = root.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.tagName).toBe('BUTTON');
    expect(buttons[0]?.getAttribute('aria-selected')).toBe('true');
    expect(buttons[1]?.getAttribute('aria-selected')).toBe('false');

    buttons[1]!.click();
    const buttonsAfterClick = root.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(buttonsAfterClick[0]?.getAttribute('aria-selected')).toBe('false');
    expect(buttonsAfterClick[1]?.getAttribute('aria-selected')).toBe('true');
  });

  it('gives each tab button a unique data-cy="tab-bar-btn-<id>" (AC-001)', () => {
    const { el } = mount(tabs);
    const root = el.shadowRoot!;
    expect(root.querySelector('[data-cy="tab-bar-btn-a"]')).not.toBeNull();
    expect(root.querySelector('[data-cy="tab-bar-btn-b"]')).not.toBeNull();
  });
});

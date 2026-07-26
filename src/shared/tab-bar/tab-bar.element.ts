import { BaseElement } from '../base-element.js';
import styles from './tab-bar.element.css?inline';

/** Definición de una pestaña: identificador (usado como `name` del slot y como
 * sufijo de `data-cy`) y etiqueta visible en el botón. */
export interface TabBarTab {
  id: string;
  label: string;
}

/**
 * Componente de pestañas agnóstico de dominio. El contenido de cada panel se
 * recibe vía `<slot name="{id}">`: el llamador añade sus propios nodos como
 * hijos ligeros de `<tab-bar>`, marcados con `slot="{id}"`. `<tab-bar>` nunca
 * crea ni destruye ese contenido — solo alterna qué panel está visible
 * mediante una clase CSS, preservando el estado interno de los paneles
 * inactivos (AC-002).
 */
class TabBarElement extends BaseElement {
  private _tabs: TabBarTab[] = [];
  private _activeId: string | undefined;

  set tabs(value: TabBarTab[]) {
    this._tabs = value;
    this._activeId ??= value[0]?.id;
    this.render();
  }

  get tabs(): TabBarTab[] {
    return this._tabs;
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
  }

  private selectTab(id: string): void {
    this._activeId = id;
    this.render();
  }

  private buildTabList(): HTMLElement {
    const tablist = document.createElement('div');
    tablist.className = 'tab-bar__list';
    tablist.setAttribute('role', 'tablist');

    this._tabs.forEach((tab) => {
      const isActive = tab.id === this._activeId;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tab-bar__btn';
      button.classList.toggle('tab-bar__btn--active', isActive);
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(isActive));
      button.setAttribute('data-cy', `tab-bar-btn-${tab.id}`);
      button.textContent = tab.label;
      button.addEventListener('click', () => {
        this.selectTab(tab.id);
      });
      tablist.appendChild(button);
    });

    return tablist;
  }

  private buildPanels(): HTMLElement {
    const panels = document.createElement('div');
    panels.className = 'tab-bar__panels';

    this._tabs.forEach((tab) => {
      const panel = document.createElement('div');
      panel.className = 'tab-bar__panel';
      panel.classList.toggle('tab-bar__panel--active', tab.id === this._activeId);
      panel.setAttribute('role', 'tabpanel');

      const slot = document.createElement('slot');
      slot.name = tab.id;
      panel.appendChild(slot);

      panels.appendChild(panel);
    });

    return panels;
  }

  protected render(): void {
    this.renderShadow(styles, this.buildTabList(), this.buildPanels());
  }
}

customElements.define('tab-bar', TabBarElement);

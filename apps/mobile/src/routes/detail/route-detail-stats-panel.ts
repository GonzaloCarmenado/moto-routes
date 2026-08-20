/**
 * Panel "Estadísticas" de <route-detail>: construcción del DOM (grid de
 * métricas + placeholder de gráfica). Extraído de route-detail.element.ts
 * para mantener ese archivo bajo el límite de tamaño
 * (specs/ui/frontend-conventions.md).
 */
import type { Route } from '../../shared/models/route.types.js';
import { formatDuration } from '../../shared/utils/format.js';

/** Grid de métricas resumen (distancia, duración, velocidad media, desnivel) de la ruta. */
export function buildStatGrid(route: Route): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'stat-grid cols-2';
  grid.innerHTML = `
    <div class="stat-tile"><span class="stat-label">Distancia</span><span class="stat-value">${route.totalDistance.toFixed(1)} <span class="stat-unit">km</span></span></div>
    <div class="stat-tile"><span class="stat-label">Duración</span><span class="stat-value">${formatDuration(route.duration)}</span></div>
    <div class="stat-tile"><span class="stat-label">Vel. media</span><span class="stat-value">${route.avgSpeed.toFixed(0)} <span class="stat-unit">km/h</span></span></div>
    <div class="stat-tile"><span class="stat-label">Desnivel</span><span class="stat-value">-- <span class="stat-unit">m</span></span></div>
  `;
  return grid;
}

function buildChart(): HTMLElement {
  const chart = document.createElement('div');
  chart.className = 'route-chart';
  chart.innerHTML = '<div class="chart-label">Velocidad durante la ruta</div><div class="chart-area">(próximamente)</div>';
  return chart;
}

/** "Estadísticas": placeholder de gráfica ya existente, sin cambios (AC-007). */
export function buildEstadisticasPanel(): HTMLElement {
  const chart = buildChart();
  chart.setAttribute('slot', 'estadisticas');
  return chart;
}

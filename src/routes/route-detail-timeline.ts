import type { RoutePoint } from '../shared/models/route.types.js';
import type { TimelinePhotoInput, TimelineDelimiter, TimelineSegment, TimelinePhotoMarker } from './route-timeline.types.js';
import {
  buildTimelineData,
  formatTimelineTime,
  formatTimelineCoords,
  formatTimelineSpeed,
} from './route-timeline.transform.js';

/**
 * Construye el panel DOM de la Timeline (slot="timeline") para inyectar
 * en el `<tab-bar>` de `<route-detail>`.
 */
export function buildTimelinePanel(
  points: RoutePoint[],
  photos: TimelinePhotoInput[],
  onPhotoClick: (photoId: string) => void,
): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('slot', 'timeline');
  section.className = 'timeline-panel';

  const data = buildTimelineData(points, photos);

  // AC-017: estado vacío total (sin GPS ni fotos)
  if (!data.hasGpsData && data.orphanPhotos.length === 0) {
    section.appendChild(buildEmptyState());
    return section;
  }

  // AC-015/AC-016: sin GPS suficiente pero con fotos huérfanas
  if (!data.hasGpsData && data.orphanPhotos.length > 0) {
    section.appendChild(buildGpsInsufficientMsg());
    for (const ph of data.orphanPhotos) {
      section.appendChild(buildPhotoEvent(ph, onPhotoClick));
    }
    return section;
  }

  // Fotos antes de Salida / después de Llegada
  for (const ph of data.photosBeforeStart) {
    section.appendChild(buildPhotoEvent(ph, onPhotoClick));
  }

  // Filas principales: delimitador + tramo + fotos del segmento
  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i]!;
    section.appendChild(buildDelimiterRow(row.delimiter));

    // Fotos dentro de este tramo
    for (const ph of row.photosInSegment) {
      section.appendChild(buildPhotoEvent(ph, onPhotoClick));
    }

    // Segmento (velocidad media del tramo) — null tras la Llegada
    if (row.segment !== null) {
      section.appendChild(buildSegmentRow(i, row.segment));
    }
  }

  // Fotos después de Llegada
  for (const ph of data.photosAfterEnd) {
    section.appendChild(buildPhotoEvent(ph, onPhotoClick));
  }

  return section;
}

function buildEmptyState(): HTMLElement {
  const msg = document.createElement('p');
  msg.className = 'timeline-empty-msg';
  msg.setAttribute('data-cy', 'route-detail-timeline-vacio');
  msg.textContent = 'No hay datos suficientes para mostrar la línea de tiempo.';
  return msg;
}

function buildGpsInsufficientMsg(): HTMLElement {
  const msg = document.createElement('p');
  msg.className = 'timeline-empty-msg';
  msg.setAttribute('data-cy', 'route-detail-timeline-vacio');
  msg.textContent = 'No hay datos GPS suficientes. Mostrando solo las fotos.';
  return msg;
}

function buildDelimiterRow(
  delimiter: TimelineDelimiter,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'timeline-row';

  const kind = delimiter.kind === 'salida' ? 'Salida'
    : delimiter.kind === 'llegada' ? 'Llegada'
    : 'Parada';

  const dataCy = delimiter.kind === 'salida' ? 'route-detail-timeline-evento-salida'
    : delimiter.kind === 'llegada' ? 'route-detail-timeline-evento-llegada'
    : 'route-detail-timeline-evento-parada';

  row.setAttribute('data-cy', dataCy);

  const label = document.createElement('span');
  label.className = 'timeline-delimiter-label';
  label.textContent = kind;

  const timeSpan = document.createElement('span');
  timeSpan.className = 'timeline-delimiter-time';
  timeSpan.textContent = formatTimelineTime(delimiter.startTime);

  row.appendChild(label);
  row.appendChild(timeSpan);

  const coordsSpan = document.createElement('span');
  coordsSpan.className = 'timeline-delimiter-coords';
  coordsSpan.textContent = formatTimelineCoords(delimiter.lat, delimiter.lng);
  row.appendChild(coordsSpan);

  // Para parada, mostrar también hora de fin
  if (delimiter.kind === 'parada' && delimiter.endTime !== delimiter.startTime) {
    const endSpan = document.createElement('span');
    endSpan.className = 'timeline-delimiter-extra';
    endSpan.textContent = '→ ' + formatTimelineTime(delimiter.endTime);
    row.appendChild(endSpan);
  }

  return row;
}

function buildSegmentRow(index: number, segment: TimelineSegment): HTMLElement {
  const row = document.createElement('div');
  row.className = 'timeline-row timeline-segment';
  row.setAttribute('data-cy', `route-detail-timeline-tramo-${String(index)}`);

  const label = document.createElement('span');
  label.className = 'timeline-segment-label';
  label.textContent = 'Vel. media';

  const value = document.createElement('span');
  value.className = 'timeline-segment-value';
  value.textContent = formatTimelineSpeed(segment.avgSpeedKmh);

  row.appendChild(label);
  row.appendChild(value);

  return row;
}

function buildPhotoEvent(
  photo: TimelinePhotoMarker,
  onPhotoClick: (photoId: string) => void,
): HTMLElement {
  const row = document.createElement('button');
  row.className = 'timeline-row timeline-photo-event';
  row.setAttribute('data-cy', `route-detail-timeline-evento-foto-${photo.photoId}`);
  row.type = 'button';
  row.addEventListener('click', (): void => { onPhotoClick(photo.photoId); });

  const label = document.createElement('span');
  label.className = 'timeline-photo-label';
  label.textContent = '📷 Foto';

  const timeSpan = document.createElement('span');
  timeSpan.className = 'timeline-photo-time';
  timeSpan.textContent = formatTimelineTime(photo.time);

  row.appendChild(label);
  row.appendChild(timeSpan);

  return row;
}
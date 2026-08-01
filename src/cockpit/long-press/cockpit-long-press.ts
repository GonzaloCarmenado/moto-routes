/**
 * Controla el long-press del botón de parada: temporizador + animación del
 * arco SVG de progreso. Sin dependencias de la clase del componente más allá
 * de los getters/callbacks que recibe — extraído para mantener
 * cockpit.element.ts bajo el límite de tamaño.
 */

export interface LongPressController {
  /** Empieza el temporizador y la animación del arco. Al completarse, llama a `onComplete`. */
  press(): void;
  /** Soltado antes de completar: cancela el temporizador y resetea el arco. */
  release(): void;
  /** Igual que `release()`; usar en `disconnectedCallback`. */
  cleanup(): void;
}

export function createLongPressController(
  durationMs: number,
  arcCircumference: number,
  getArcCircle: () => SVGCircleElement | null,
  onComplete: () => void,
): LongPressController {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function resetArc(): void {
    const circle = getArcCircle();
    if (circle) circle.style.strokeDasharray = `0 ${String(arcCircumference)}`;
  }

  function animateArc(): void {
    const startTime = Date.now();
    const step = (): void => {
      const circle = getArcCircle();
      if (!circle) return;
      const progress = Math.min((Date.now() - startTime) / durationMs, 1);
      circle.style.strokeDasharray = `${String(arcCircumference * progress)} ${String(arcCircumference)}`;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function cleanup(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    resetArc();
  }

  return {
    press(): void {
      timer = setTimeout(() => {
        cleanup();
        onComplete();
      }, durationMs);
      animateArc();
    },
    release: cleanup,
    cleanup,
  };
}

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLongPressController } from './cockpit-long-press.js';

function createFakeCircle(): SVGCircleElement {
  return document.createElementNS('http://www.w3.org/2000/svg', 'circle');
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createLongPressController', () => {
  it('calls onComplete once the full duration has elapsed', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const controller = createLongPressController(1500, 377, () => null, onComplete);

    controller.press();
    vi.advanceTimersByTime(1499);
    expect(onComplete).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('does not call onComplete if released before the duration elapses', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const controller = createLongPressController(1500, 377, () => null, onComplete);

    controller.press();
    vi.advanceTimersByTime(1000);
    controller.release();
    vi.advanceTimersByTime(1000);

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('resets the arc dasharray to 0 on release', () => {
    vi.useFakeTimers();
    const circle = createFakeCircle();
    const controller = createLongPressController(1500, 377, () => circle, vi.fn());

    controller.press();
    vi.advanceTimersByTime(750);
    controller.release();

    expect(circle.style.strokeDasharray).toBe('0 377');
  });

  it('resets the arc dasharray on cleanup too (used in disconnectedCallback)', () => {
    vi.useFakeTimers();
    const circle = createFakeCircle();
    const controller = createLongPressController(1500, 377, () => circle, vi.fn());

    controller.press();
    controller.cleanup();

    expect(circle.style.strokeDasharray).toBe('0 377');
  });

  it('cancels the pending onComplete when cleanup runs mid-press', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const controller = createLongPressController(1500, 377, () => null, onComplete);

    controller.press();
    controller.cleanup();
    vi.advanceTimersByTime(1500);

    expect(onComplete).not.toHaveBeenCalled();
  });
});

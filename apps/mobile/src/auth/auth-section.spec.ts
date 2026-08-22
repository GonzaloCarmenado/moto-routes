import { describe, it, expect, vi } from 'vitest';
import { buildAuthSection } from './auth-section.js';

describe('buildAuthSection', () => {
  it('sin sesión, muestra los botones de iniciar sesión, crear cuenta y recuperar contraseña', () => {
    const callbacks = { onOpenLogin: vi.fn(), onOpenRegister: vi.fn(), onOpenForgotPassword: vi.fn(), onLogout: vi.fn(), onEditUsername: vi.fn() };

    const el = buildAuthSection({ status: 'logged-out' }, callbacks);

    const loginBtn = el.querySelector('[data-cy="auth-btn-abrir-login"]') as HTMLButtonElement;
    const registerBtn = el.querySelector('[data-cy="auth-btn-abrir-registro"]') as HTMLButtonElement;
    const forgotBtn = el.querySelector('[data-cy="auth-btn-abrir-recuperar"]') as HTMLButtonElement;
    expect(loginBtn).not.toBeNull();
    expect(registerBtn).not.toBeNull();
    expect(forgotBtn).not.toBeNull();
    expect(el.querySelector('[data-cy="auth-btn-cerrar-sesion"]')).toBeNull();

    loginBtn.click();
    expect(callbacks.onOpenLogin).toHaveBeenCalledTimes(1);
    registerBtn.click();
    expect(callbacks.onOpenRegister).toHaveBeenCalledTimes(1);
    forgotBtn.click();
    expect(callbacks.onOpenForgotPassword).toHaveBeenCalledTimes(1);
  });

  it('con sesión, muestra el email y el botón de cerrar sesión', () => {
    const callbacks = { onOpenLogin: vi.fn(), onOpenRegister: vi.fn(), onOpenForgotPassword: vi.fn(), onLogout: vi.fn(), onEditUsername: vi.fn() };

    const el = buildAuthSection({ status: 'logged-in', email: 'rider@example.com', username: 'rider42' }, callbacks);

    expect(el.textContent).toContain('rider@example.com');
    expect(el.querySelector('[data-cy="auth-btn-abrir-login"]')).toBeNull();
    expect(el.querySelector('[data-cy="auth-btn-abrir-registro"]')).toBeNull();

    (el.querySelector('[data-cy="auth-btn-cerrar-sesion"]') as HTMLButtonElement).click();
    expect(callbacks.onLogout).toHaveBeenCalledTimes(1);
  });

  it('con sesión y username fijado, muestra el username y un botón para editarlo', () => {
    const callbacks = { onOpenLogin: vi.fn(), onOpenRegister: vi.fn(), onOpenForgotPassword: vi.fn(), onLogout: vi.fn(), onEditUsername: vi.fn() };

    const el = buildAuthSection({ status: 'logged-in', email: 'rider@example.com', username: 'rider42' }, callbacks);

    expect(el.textContent).toContain('rider42');
    const editBtn = el.querySelector('[data-cy="auth-btn-editar-username"]') as HTMLButtonElement;
    expect(editBtn).not.toBeNull();
    editBtn.click();
    expect(callbacks.onEditUsername).toHaveBeenCalledTimes(1);
  });

  it('con sesión pero sin username fijado, muestra un aviso y un botón para fijarlo', () => {
    const callbacks = { onOpenLogin: vi.fn(), onOpenRegister: vi.fn(), onOpenForgotPassword: vi.fn(), onLogout: vi.fn(), onEditUsername: vi.fn() };

    const el = buildAuthSection({ status: 'logged-in', email: 'rider@example.com', username: null }, callbacks);

    const editBtn = el.querySelector('[data-cy="auth-btn-editar-username"]') as HTMLButtonElement;
    expect(editBtn).not.toBeNull();
    editBtn.click();
    expect(callbacks.onEditUsername).toHaveBeenCalledTimes(1);
  });

  it('lleva el data-cy de la propia sección', () => {
    const el = buildAuthSection(
      { status: 'logged-out' },
      { onOpenLogin: vi.fn(), onOpenRegister: vi.fn(), onOpenForgotPassword: vi.fn(), onLogout: vi.fn(), onEditUsername: vi.fn() },
    );

    expect(el.getAttribute('data-cy')).toBe('auth-section-cuenta');
  });
});

/**
 * Utilidades genéricas de saneado de texto libre reutilizadas por varios
 * dominios (rutas, perfil) que comparten la misma regla de "trim + límite
 * de longitud" antes de persistir un campo de texto escrito por el usuario.
 */

/**
 * Recorta espacios en los extremos y trunca al límite de longitud dado.
 * No decide ningún fallback por defecto para el caso vacío — un resultado
 * `''` es responsabilidad del llamador.
 * @param raw - Texto tal como lo escribió el usuario, sin procesar.
 * @param maxLength - Número máximo de caracteres permitido tras el trim.
 * @returns El texto recortado y truncado.
 */
export function sanitizeText(raw: string, maxLength: number): string {
  return raw.trim().slice(0, maxLength);
}

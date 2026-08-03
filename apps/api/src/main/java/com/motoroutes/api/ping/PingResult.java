package com.motoroutes.api.ping;

import java.time.OffsetDateTime;

/**
 * Resultado de la comprobación de conectividad con PostgreSQL. {@code databaseTime} solo se
 * rellena cuando la consulta tuvo éxito, para que un valor no estático deje constancia real de
 * que la base de datos respondió.
 */
public record PingResult(boolean healthy, OffsetDateTime databaseTime, String error) {

  /** Construye un resultado sano a partir del valor real leído de la base de datos. */
  public static PingResult healthy(OffsetDateTime databaseTime) {
    return new PingResult(true, databaseTime, null);
  }

  /** Construye un resultado de fallo con el mensaje de la excepción de acceso a datos. */
  public static PingResult unhealthy(String error) {
    return new PingResult(false, null, error);
  }
}

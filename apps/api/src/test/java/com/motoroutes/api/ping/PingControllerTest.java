package com.motoroutes.api.ping;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Test unitario puro (sin contexto Spring): mockea únicamente el {@link JdbcTemplate}, el único
 * límite externo real de este endpoint, para verificar que la respuesta HTTP refleja el estado
 * real de la conectividad con PostgreSQL en vez de un valor estático.
 */
class PingControllerTest {

  private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
  private final PingController controller = new PingController(new PingService(jdbcTemplate));

  @Test
  void respondsOkWithTheRealDatabaseValueWhenPostgresIsReachable() {
    OffsetDateTime dbTime = OffsetDateTime.now();
    when(jdbcTemplate.queryForObject("SELECT now()", OffsetDateTime.class)).thenReturn(dbTime);

    ResponseEntity<PingResult> response = controller.ping();

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody()).isNotNull();
    assertThat(response.getBody().healthy()).isTrue();
    assertThat(response.getBody().databaseTime()).isEqualTo(dbTime);
  }

  @Test
  void respondsServiceUnavailableWithoutCrashingWhenPostgresIsUnreachable() {
    when(jdbcTemplate.queryForObject("SELECT now()", OffsetDateTime.class))
        .thenThrow(new DataAccessResourceFailureException("connection refused"));

    ResponseEntity<PingResult> response = controller.ping();

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    assertThat(response.getBody()).isNotNull();
    assertThat(response.getBody().healthy()).isFalse();
    assertThat(response.getBody().error()).contains("connection refused");
  }
}

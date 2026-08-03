package com.motoroutes.api.ping;

import java.time.OffsetDateTime;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Verifica la conectividad real con PostgreSQL ejecutando una consulta, en vez de asumir que el
 * proceso Spring Boot arrancado implica que la base de datos está accesible.
 */
@Service
public class PingService {

  private final JdbcTemplate jdbcTemplate;

  public PingService(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public PingResult ping() {
    try {
      OffsetDateTime databaseTime = jdbcTemplate.queryForObject("SELECT now()", OffsetDateTime.class);
      return PingResult.healthy(databaseTime);
    } catch (DataAccessException ex) {
      return PingResult.unhealthy(ex.getMessage());
    }
  }
}

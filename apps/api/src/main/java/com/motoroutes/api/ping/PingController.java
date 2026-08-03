package com.motoroutes.api.ping;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoint de prueba: su código de estado refleja si PostgreSQL respondió de verdad, no solo si
 * el proceso de la API está arriba.
 */
@RestController
public class PingController {

  private final PingService pingService;

  public PingController(PingService pingService) {
    this.pingService = pingService;
  }

  @GetMapping("/api/ping")
  public ResponseEntity<PingResult> ping() {
    PingResult result = pingService.ping();
    return result.healthy()
        ? ResponseEntity.ok(result)
        : ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(result);
  }
}

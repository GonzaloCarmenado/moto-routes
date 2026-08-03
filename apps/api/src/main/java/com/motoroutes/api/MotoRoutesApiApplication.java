package com.motoroutes.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Punto de entrada de la API mínima de Moto Routes. */
@SpringBootApplication
public class MotoRoutesApiApplication {

  public static void main(String[] args) {
    SpringApplication.run(MotoRoutesApiApplication.class, args);
  }
}

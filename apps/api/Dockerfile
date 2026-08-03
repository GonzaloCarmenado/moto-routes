# syntax=docker/dockerfile:1

# Ambas etapas parten de Debian 13 (trixie) para tener paridad real con el
# servidor de producción — eclipse-temurin (la imagen oficial de OpenJDK) no
# publica todavía ninguna variante trixie, así que el JDK/JRE se instala vía
# apt en vez de partir de una imagen Java ya construida (ver ADR-032).

FROM debian:trixie AS build
RUN apt-get update \
    && apt-get install -y --no-install-recommends openjdk-21-jdk-headless maven \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -B package -DskipTests

FROM debian:trixie-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends openjdk-21-jre-headless \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/target/api-*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

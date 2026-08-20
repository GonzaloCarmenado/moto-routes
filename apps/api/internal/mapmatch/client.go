// Package mapmatch llama al servicio OSRM self-hosted para ajustar puntos GPS
// ruidosos a la carretera más probable (ver design.md de
// normalizar-y-exportar-rutas, Decisiones 1-4 y 7).
package mapmatch

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

// chunkSize es el máximo de coordenadas por petición a OSRM (su límite por
// defecto es 100). Rutas más largas se trocean con solape de 1 punto entre
// bloques consecutivos (ver design.md, Decisión 4).
const chunkSize = 100

// maxSnapDistanceMeters descarta un ajuste que se aleje demasiado del punto
// original — evita "pegar" un punto a una carretera equivocada cuando el GPS
// dio un salto grande (ver design.md, Decisión 7).
const maxSnapDistanceMeters = 30.0

// profile es el perfil de enrutamiento de OSRM usado para el ajuste. OSRM no
// trae uno de moto de fábrica; a efectos de "pegar a la carretera" (no de
// calcular itinerarios) el perfil car es suficiente (ver design.md, Decisión 3).
const profile = "car"

// Point es un punto GPS (latitud/longitud), de entrada o ya ajustado.
type Point struct {
	Lat float64
	Lng float64
}

// Client llama al endpoint /match de un servicio OSRM propio vía HTTP plano,
// sin SDK (ver design.md, Decisión 2).
type Client struct {
	// BaseURL es la URL base del servicio OSRM (ej. http://osrm:5000), sin
	// slash final.
	BaseURL string
	// HTTPClient es el cliente HTTP usado para las peticiones. Si es nil, se
	// usa http.DefaultClient.
	HTTPClient *http.Client
}

type osrmTracepoint struct {
	Location [2]float64 `json:"location"`
	Distance float64    `json:"distance"`
}

type osrmMatchResponse struct {
	Code        string            `json:"code"`
	Message     string            `json:"message"`
	Tracepoints []*osrmTracepoint `json:"tracepoints"`
}

// Match ajusta cada punto de points a la carretera más probable. Devuelve un
// resultado por punto de entrada, en el mismo orden: nil si OSRM no encontró
// ninguna carretera lo bastante cerca (bien porque no hubo coincidencia en
// absoluto, bien porque la coincidencia superaba maxSnapDistanceMeters). Un
// error solo se devuelve ante un fallo real del servicio (red, timeout,
// respuesta HTTP distinta de 200) — nunca por la simple ausencia de
// coincidencia, que es un resultado válido de map-matching.
func (c Client) Match(ctx context.Context, points []Point) ([]*Point, error) {
	if len(points) == 0 {
		return nil, nil
	}

	results := make([]*Point, 0, len(points))
	for i, chunk := range chunkPoints(points) {
		chunkResults, err := c.matchChunk(ctx, chunk)
		if err != nil {
			return nil, err
		}
		if i > 0 {
			// El primer punto del bloque es el punto de solape con el bloque
			// anterior (ver design.md, Decisión 4) — ya está en results.
			chunkResults = chunkResults[1:]
		}
		results = append(results, chunkResults...)
	}
	return results, nil
}

// chunkPoints trocea points en bloques de como máximo chunkSize, solapando 1
// punto entre bloques consecutivos para dar contexto de continuidad al
// algoritmo de map-matching en el borde de cada bloque.
func chunkPoints(points []Point) [][]Point {
	if len(points) <= chunkSize {
		return [][]Point{points}
	}

	var chunks [][]Point
	start := 0
	for {
		end := start + chunkSize
		if end >= len(points) {
			chunks = append(chunks, points[start:])
			break
		}
		chunks = append(chunks, points[start:end])
		start = end - 1
	}
	return chunks
}

func (c Client) matchChunk(ctx context.Context, chunk []Point) ([]*Point, error) {
	coords := make([]string, len(chunk))
	for i, p := range chunk {
		coords[i] = fmt.Sprintf("%.6f,%.6f", p.Lng, p.Lat)
	}
	url := fmt.Sprintf("%s/match/v1/%s/%s?overview=false", c.BaseURL, profile, strings.Join(coords, ";"))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build osrm match request: %w", err)
	}

	httpClient := c.HTTPClient
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call osrm match: %w", err)
	}
	defer resp.Body.Close()

	var parsed osrmMatchResponse
	decodeErr := json.NewDecoder(resp.Body).Decode(&parsed)

	if resp.StatusCode != http.StatusOK {
		// OSRM responde con un status distinto de 200 tanto ante un fallo real
		// del servicio como ante "sin coincidencia para ningún punto del
		// bloque" (code NoMatch/NoSegment) — solo lo segundo es un resultado
		// válido de map-matching, no un error (ver design.md, Decisión 7).
		if decodeErr == nil && isNoMatchCode(parsed.Code) {
			return make([]*Point, len(chunk)), nil
		}
		return nil, fmt.Errorf("osrm match returned status %d", resp.StatusCode)
	}
	if decodeErr != nil {
		return nil, fmt.Errorf("decode osrm match response: %w", decodeErr)
	}

	results := make([]*Point, len(chunk))
	if parsed.Code != "Ok" {
		// Sin coincidencia para ningún punto de este bloque — resultado
		// válido de map-matching, no un error (ver design.md, Decisión 7).
		return results, nil
	}

	for i, tp := range parsed.Tracepoints {
		if i >= len(results) || tp == nil || tp.Distance > maxSnapDistanceMeters {
			continue
		}
		results[i] = &Point{Lat: tp.Location[1], Lng: tp.Location[0]}
	}
	return results, nil
}

// isNoMatchCode distingue "sin coincidencia" (resultado válido de
// map-matching, ver design.md Decisión 7) de un error real de OSRM (ej.
// InvalidQuery, señal de un bug en cómo construimos la propia petición).
func isNoMatchCode(code string) bool {
	return code == "NoMatch" || code == "NoSegment"
}

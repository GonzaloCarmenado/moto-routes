package mapmatch

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"
)

// coordinatesFromPath extrae la lista de [lat,lng] del segmento
// "/match/v1/car/{lng},{lat};..." de una petición real hecha por el cliente,
// para poder inspeccionar en los tests qué coordenadas envió cada chunk.
func coordinatesFromPath(t *testing.T, path string) [][2]float64 {
	t.Helper()
	const prefix = "/match/v1/car/"
	if !strings.HasPrefix(path, prefix) {
		t.Fatalf("unexpected request path: %s", path)
	}
	pairs := strings.Split(strings.TrimPrefix(path, prefix), ";")
	coords := make([][2]float64, len(pairs))
	for i, pair := range pairs {
		parts := strings.SplitN(pair, ",", 2)
		lng, err := strconv.ParseFloat(parts[0], 64)
		if err != nil {
			t.Fatalf("failed to parse lng from %q: %v", pair, err)
		}
		lat, err := strconv.ParseFloat(parts[1], 64)
		if err != nil {
			t.Fatalf("failed to parse lat from %q: %v", pair, err)
		}
		coords[i] = [2]float64{lat, lng}
	}
	return coords
}

func newTestClient(t *testing.T, handler http.HandlerFunc) Client {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	return Client{BaseURL: server.URL, HTTPClient: &http.Client{Timeout: 2 * time.Second}}
}

// fakeMatchResponseBody construye una respuesta /match de OSRM con un
// tracepoint por cada punto ajustado (nil para "sin ajuste" en esa posición).
func fakeMatchResponseBody(adjustedLatLng [][2]float64) string {
	tracepoints := "["
	for i, p := range adjustedLatLng {
		if i > 0 {
			tracepoints += ","
		}
		if p == ([2]float64{}) {
			tracepoints += "null"
			continue
		}
		tracepoints += fmt.Sprintf(`{"location":[%f,%f],"distance":5.0}`, p[1], p[0])
	}
	tracepoints += "]"
	return fmt.Sprintf(`{"code":"Ok","tracepoints":%s}`, tracepoints)
}

func TestClient_Match_SingleChunkReturnsAdjustedPointsInOrder(t *testing.T) {
	client := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/match/v1/car/-3.100000,40.100000;-3.200000,40.200000" {
			t.Fatalf("unexpected request path: %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(fakeMatchResponseBody([][2]float64{{40.1001, -3.1001}, {40.2001, -3.2001}})))
	})

	got, err := client.Match(context.Background(), []Point{{Lat: 40.1, Lng: -3.1}, {Lat: 40.2, Lng: -3.2}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 results, got %d", len(got))
	}
	if got[0] == nil || got[0].Lat != 40.1001 || got[0].Lng != -3.1001 {
		t.Fatalf("unexpected first point: %+v", got[0])
	}
	if got[1] == nil || got[1].Lat != 40.2001 || got[1].Lng != -3.2001 {
		t.Fatalf("unexpected second point: %+v", got[1])
	}
}

func TestClient_Match_ChunksMoreThan100PointsWithOverlap(t *testing.T) {
	points := make([]Point, 150)
	for i := range points {
		points[i] = Point{Lat: 40.0 + float64(i)*0.0001, Lng: -3.0 - float64(i)*0.0001}
	}

	var requestSizes []int
	client := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		coords := coordinatesFromPath(t, r.URL.Path)
		requestSizes = append(requestSizes, len(coords))

		adjusted := make([][2]float64, len(coords))
		for i, c := range coords {
			adjusted[i] = [2]float64{c[0], c[1]}
		}
		_, _ = w.Write([]byte(fakeMatchResponseBody(adjusted)))
	})

	got, err := client.Match(context.Background(), points)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 150 {
		t.Fatalf("expected 150 results (no duplicated overlap point), got %d", len(got))
	}
	if len(requestSizes) != 2 {
		t.Fatalf("expected exactly 2 chunked requests, got %d", len(requestSizes))
	}
	if requestSizes[0] != 100 {
		t.Fatalf("expected the first chunk to have 100 points, got %d", requestSizes[0])
	}
}

func TestClient_Match_DiscardsAdjustmentFartherThan30Meters(t *testing.T) {
	client := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		// Un punto ajustado a ~40 metros del original (excede el umbral de 30 m).
		_, _ = w.Write([]byte(`{"code":"Ok","tracepoints":[{"location":[-3.1,40.1004],"distance":40.0}]}`))
	})

	got, err := client.Match(context.Background(), []Point{{Lat: 40.1, Lng: -3.1}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 result, got %d", len(got))
	}
	if got[0] != nil {
		t.Fatalf("expected the adjustment to be discarded (nil), got %+v", got[0])
	}
}

func TestClient_Match_NoMatchForWholeChunkLeavesAllPointsUnadjusted(t *testing.T) {
	client := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"code":"NoMatch","message":"Could not match the trace"}`))
	})

	got, err := client.Match(context.Background(), []Point{{Lat: 40.1, Lng: -3.1}, {Lat: 40.2, Lng: -3.2}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 2 || got[0] != nil || got[1] != nil {
		t.Fatalf("expected both points unadjusted (nil), got %+v", got)
	}
}

func TestClient_Match_NullTracepointLeavesThatPointUnadjusted(t *testing.T) {
	client := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"code":"Ok","tracepoints":[null,{"location":[-3.2,40.2],"distance":1.0}]}`))
	})

	got, err := client.Match(context.Background(), []Point{{Lat: 40.1, Lng: -3.1}, {Lat: 40.2, Lng: -3.2}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got[0] != nil {
		t.Fatalf("expected the first point to stay unadjusted (nil), got %+v", got[0])
	}
	if got[1] == nil {
		t.Fatal("expected the second point to be adjusted")
	}
}

func TestClient_Match_ReturnsErrorOnServerFailure(t *testing.T) {
	client := newTestClient(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	_, err := client.Match(context.Background(), []Point{{Lat: 40.1, Lng: -3.1}, {Lat: 40.2, Lng: -3.2}})
	if err == nil {
		t.Fatal("expected an explicit error when OSRM responds with a server error")
	}
}

func TestClient_Match_ReturnsErrorOnTimeout(t *testing.T) {
	client := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(50 * time.Millisecond)
		_, _ = w.Write([]byte(fakeMatchResponseBody([][2]float64{{40.1, -3.1}, {40.2, -3.2}})))
	})
	client.HTTPClient = &http.Client{Timeout: 10 * time.Millisecond}

	_, err := client.Match(context.Background(), []Point{{Lat: 40.1, Lng: -3.1}, {Lat: 40.2, Lng: -3.2}})
	if err == nil {
		t.Fatal("expected an explicit error on timeout")
	}
	var netErr interface{ Timeout() bool }
	if !errors.As(err, &netErr) {
		t.Logf("error is not a net.Error, but any explicit error is acceptable here: %v", err)
	}
}

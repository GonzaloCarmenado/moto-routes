package stoptypes

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

type fakeRepository struct {
	types []StopType
}

func (f fakeRepository) List(_ context.Context) ([]StopType, error) {
	return f.types, nil
}

func TestHandler_ReturnsCatalogWithoutRequiringAuth(t *testing.T) {
	repo := fakeRepository{types: []StopType{
		{ID: 1, Key: "bar-restaurante", Label: "Bar / restaurante", Icon: "🍽️"},
		{ID: 2, Key: "mirador", Label: "Mirador", Icon: "🏔️"},
	}}

	req := httptest.NewRequest(http.MethodGet, "/api/stop-types", nil)
	rec := httptest.NewRecorder()

	Handler(repo).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var body []StopType
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if len(body) != 2 {
		t.Fatalf("expected 2 stop types, got %d", len(body))
	}
	if body[0].Key != "bar-restaurante" || body[0].Label != "Bar / restaurante" || body[0].Icon != "🍽️" {
		t.Fatalf("unexpected first stop type: %+v", body[0])
	}
}

func TestHandler_EmptyCatalogReturns200WithEmptyList(t *testing.T) {
	repo := fakeRepository{types: []StopType{}}

	req := httptest.NewRequest(http.MethodGet, "/api/stop-types", nil)
	rec := httptest.NewRecorder()

	Handler(repo).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var body []StopType
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if len(body) != 0 {
		t.Fatalf("expected an empty list, got %d items", len(body))
	}
}

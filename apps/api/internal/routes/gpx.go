package routes

import (
	"encoding/xml"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/crzverde/moto-routes/apps/api/internal/apihttp"
)

const gpxNamespace = "http://www.topografix.com/GPX/1/1"

type gpxDoc struct {
	XMLName   xml.Name      `xml:"gpx"`
	Version   string        `xml:"version,attr"`
	Creator   string        `xml:"creator,attr"`
	Xmlns     string        `xml:"xmlns,attr"`
	Waypoints []gpxWaypoint `xml:"wpt"`
	Track     gpxTrack      `xml:"trk"`
}

type gpxWaypoint struct {
	Lat  float64 `xml:"lat,attr"`
	Lon  float64 `xml:"lon,attr"`
	Name string  `xml:"name,omitempty"`
}

type gpxTrack struct {
	Name     string            `xml:"name,omitempty"`
	Segments []gpxTrackSegment `xml:"trkseg"`
}

type gpxTrackSegment struct {
	Points []gpxTrackPoint `xml:"trkpt"`
}

type gpxTrackPoint struct {
	Lat  float64 `xml:"lat,attr"`
	Lon  float64 `xml:"lon,attr"`
	Ele  float64 `xml:"ele,omitempty"`
	Time string  `xml:"time,omitempty"`
}

// GPXExportHandler exporta una ruta del usuario autenticado como un fichero
// GPX 1.1 estándar. Usa los puntos ajustados a carretera cuando existen y cae
// a los puntos GPS originales en caso contrario (ver
// specs/exportacion-gpx/spec.md). Misma autenticación/autorización que
// DetailHandler: 404 tanto si la ruta no existe como si pertenece a otro
// usuario, sin distinguir cuál.
func GPXExportHandler(store Store) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}

		id := chi.URLParam(r, "id")
		detail, err := store.GetByIDForUser(r.Context(), userID, id)
		if err != nil {
			apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
			return
		}
		if detail == nil {
			apihttp.WriteError(w, http.StatusNotFound, "route not found")
			return
		}
		if len(detail.Points) == 0 {
			apihttp.WriteError(w, http.StatusBadRequest, "route has no GPS points to export")
			return
		}

		doc := buildGPX(*detail)
		body, err := xml.MarshalIndent(doc, "", "  ")
		if err != nil {
			apihttp.WriteError(w, http.StatusInternalServerError, "could not generate the GPX file")
			return
		}

		w.Header().Set("Content-Type", "application/gpx+xml")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="route-%s.gpx"`, detail.ID))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(xml.Header))
		_, _ = w.Write(body)
	})
}

func buildGPX(detail Detail) gpxDoc {
	points := make([]gpxTrackPoint, len(detail.Points))
	for i, p := range detail.Points {
		lat, lng := p.Lat, p.Lng
		if p.MatchedLat != nil && p.MatchedLng != nil {
			lat, lng = *p.MatchedLat, *p.MatchedLng
		}
		points[i] = gpxTrackPoint{
			Lat:  lat,
			Lon:  lng,
			Ele:  p.Alt,
			Time: time.UnixMilli(p.Timestamp).UTC().Format(time.RFC3339),
		}
	}

	waypoints := make([]gpxWaypoint, len(detail.Stops))
	for i, s := range detail.Stops {
		waypoints[i] = gpxWaypoint{Lat: s.Lat, Lon: s.Lng, Name: "Parada"}
	}

	return gpxDoc{
		Version:   "1.1",
		Creator:   "Moto Routes",
		Xmlns:     gpxNamespace,
		Waypoints: waypoints,
		Track: gpxTrack{
			Name:     routeDisplayName(detail),
			Segments: []gpxTrackSegment{{Points: points}},
		},
	}
}

func routeDisplayName(detail Detail) string {
	if detail.Name != nil && *detail.Name != "" {
		return *detail.Name
	}
	return "Ruta " + detail.ID
}

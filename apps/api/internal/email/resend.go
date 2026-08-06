package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// defaultResendBaseURL es la API real de Resend. ResendSender.BaseURL se deja
// vacío en producción y solo se sobreescribe en tests contra un servidor de
// pruebas.
const defaultResendBaseURL = "https://api.resend.com"

// ResendSender envía email vía la API REST de Resend con net/http estándar
// — sin el SDK oficial, ver design.md (regla de dependencias mínimas: la
// superficie usada aquí es un único POST JSON con un header).
type ResendSender struct {
	// APIKey es el secreto de autenticación (Bearer). Nunca se hardcodea, ver
	// config.RESEND_API_KEY.
	APIKey string
	// From es el remitente, con el formato "Nombre <direccion@dominio>".
	From string
	// BaseURL sobreescribe la URL de la API de Resend; vacío = producción.
	BaseURL string
	// HTTPClient permite inyectar un cliente distinto; nil = http.DefaultClient.
	HTTPClient *http.Client
}

type resendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

// Send envía un email HTML a un único destinatario a través de Resend.
func (s ResendSender) Send(ctx context.Context, to, subject, htmlBody string) error {
	baseURL := s.BaseURL
	if baseURL == "" {
		baseURL = defaultResendBaseURL
	}

	body, err := json.Marshal(resendRequest{From: s.From, To: []string{to}, Subject: subject, HTML: htmlBody})
	if err != nil {
		return fmt.Errorf("encode resend request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/emails", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build resend request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.APIKey)

	client := s.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("call resend: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("resend responded with status %d: %s", resp.StatusCode, respBody)
	}

	return nil
}

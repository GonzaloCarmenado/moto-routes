package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// fcmMessagingScope es el único permiso OAuth2 solicitado — enviar mensajes,
// nada de leer/escribir otros recursos del proyecto Firebase.
const fcmMessagingScope = "https://www.googleapis.com/auth/firebase.messaging"

// NewFCMNotifier construye un FCMNotifier autenticado a partir del JSON de
// una cuenta de servicio de Firebase (golang.org/x/oauth2/google se encarga
// del intercambio OAuth2 — ver design.md, Decisión 3: nunca firma de JWT
// hecha a mano). El ID de proyecto se obtiene del propio JSON, sin variable
// de entorno aparte.
func NewFCMNotifier(ctx context.Context, serviceAccountJSON string, tokenStore DeviceTokenStore) (FCMNotifier, error) {
	creds, err := google.CredentialsFromJSON(ctx, []byte(serviceAccountJSON), fcmMessagingScope)
	if err != nil {
		return FCMNotifier{}, fmt.Errorf("parse FCM service account JSON: %w", err)
	}
	if creds.ProjectID == "" {
		return FCMNotifier{}, errors.New("FCM service account JSON has no project_id")
	}

	return FCMNotifier{
		ProjectID:  creds.ProjectID,
		HTTPClient: oauth2.NewClient(ctx, creds.TokenSource),
		TokenStore: tokenStore,
	}, nil
}

// defaultFCMBaseURL es la API real de Firebase Cloud Messaging (HTTP v1).
// FCMNotifier.BaseURL se deja vacío en producción y solo se sobreescribe en
// tests contra un servidor de pruebas — mismo criterio que ResendSender.
const defaultFCMBaseURL = "https://fcm.googleapis.com"

// FCMNotifier envía notificaciones push vía la API HTTP v1 de Firebase Cloud
// Messaging, sin el SDK de Firebase Admin (ver design.md, Decisión 3): la
// superficie usada es un único POST JSON autenticado por token.
type FCMNotifier struct {
	// ProjectID es el ID del proyecto Firebase (parte de la URL del endpoint).
	ProjectID string
	// BaseURL sobreescribe la URL de la API de FCM; vacío = producción.
	BaseURL string
	// HTTPClient ya debe estar autenticado (OAuth2, vía golang.org/x/oauth2/google
	// a partir de la cuenta de servicio) — FCMNotifier no gestiona el token de
	// acceso, solo lo usa. En tests, un *http.Client sin autenticar contra un
	// servidor de pruebas es suficiente.
	HTTPClient *http.Client
	// TokenStore da los tokens de dispositivo del usuario y permite eliminar
	// los que FCM confirme como inválidos/no registrados.
	TokenStore DeviceTokenStore
}

type fcmMessage struct {
	Message struct {
		Token string            `json:"token"`
		Data  map[string]string `json:"data"`
	} `json:"message"`
}

// Send envía la notificación a todos los dispositivos registrados del
// usuario. Sin ningún token registrado no es un error (nada que hacer). Un
// token que FCM confirma inválido/no registrado (404) se elimina de
// TokenStore; otros fallos se acumulan y se devuelven juntos (un dispositivo
// fallando no impide intentar el resto).
func (n FCMNotifier) Send(ctx context.Context, userID int64, eventType string, data map[string]string) error {
	tokens, err := n.TokenStore.TokensForUser(ctx, userID)
	if err != nil {
		return fmt.Errorf("look up device tokens: %w", err)
	}

	payload := map[string]string{"type": eventType}
	for k, v := range data {
		payload[k] = v
	}

	var errs []error
	for _, token := range tokens {
		if err := n.sendToToken(ctx, token, payload); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func (n FCMNotifier) sendToToken(ctx context.Context, token string, data map[string]string) error {
	baseURL := n.BaseURL
	if baseURL == "" {
		baseURL = defaultFCMBaseURL
	}

	var body fcmMessage
	body.Message.Token = token
	body.Message.Data = data
	encoded, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("encode fcm request: %w", err)
	}

	url := fmt.Sprintf("%s/v1/projects/%s/messages:send", baseURL, n.ProjectID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(encoded))
	if err != nil {
		return fmt.Errorf("build fcm request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("call fcm: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		// Token inválido o no registrado (app desinstalada, etc.) — se
		// elimina para no reintentar en vano en el próximo envío.
		if delErr := n.TokenStore.Delete(ctx, token); delErr != nil {
			return fmt.Errorf("fcm reported token %s as invalid, but failed to delete it: %w", token, delErr)
		}
		return nil
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("fcm responded with status %d: %s", resp.StatusCode, respBody)
	}

	return nil
}

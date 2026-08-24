// Package avatar sube y sirve el avatar de la cuenta autenticada — bytes
// cifrados en un almacenamiento de objetos, sin ninguna fila en Postgres (la
// existencia se determina intentando leer el objeto). Reutiliza el
// BlobStore y la clave de cifrado ya existentes de internal/photos en vez de
// construir un mecanismo nuevo (ver design.md de unificar-perfil-cuenta,
// Decisión 1 / ADR-055).
package avatar

import (
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/crzverde/moto-routes/apps/api/internal/apihttp"
	"github.com/crzverde/moto-routes/apps/api/internal/auth"
	"github.com/crzverde/moto-routes/apps/api/internal/photos"
)

// avatarNotFoundMessage es el mismo mensaje de 404 tanto si el username no
// corresponde a ninguna cuenta como si la cuenta existe pero no tiene avatar
// — el username ya se sabe que existe si vino de una búsqueda previa (ver
// selector-amigos, design.md), así que no hace falta distinguir el caso.
const avatarNotFoundMessage = "no avatar configured for this account"

// MaxAvatarSizeBytes es el tamaño máximo aceptado por avatar — más pequeño
// que MaxPhotoSizeBytes (15MB) porque un avatar solo necesita mostrarse en
// miniatura, nunca a resolución completa de cámara.
const MaxAvatarSizeBytes = 5 * 1024 * 1024

// maxMultipartMemory es cuánto del cuerpo multipart se mantiene en memoria
// antes de que ParseMultipartForm derrame a ficheros temporales — no acota
// el tamaño del avatar en sí, eso lo hace MaxAvatarSizeBytes más abajo.
const maxMultipartMemory = 1 << 20 // 1MiB

// objectKeyForUser es la clave determinista bajo la que vive el avatar de un
// usuario — subir un avatar nuevo sustituye al anterior en la misma clave,
// nunca acumula objetos huérfanos (ver design.md, Decisión 1).
func objectKeyForUser(userID int64) string {
	return "avatars/" + strconv.FormatInt(userID, 10)
}

// UploadAvatarHandler sube un avatar nuevo para la cuenta autenticada,
// cifrado antes de subirlo, sustituyendo cualquier avatar anterior de esa
// misma cuenta (misma clave de objeto determinista).
func UploadAvatarHandler(store photos.BlobStore, encryptionKey []byte) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, MaxAvatarSizeBytes+maxMultipartMemory)
		if err := r.ParseMultipartForm(maxMultipartMemory); err != nil {
			apihttp.WriteError(w, http.StatusBadRequest, "avatar exceeds the maximum allowed size or the request body is invalid")
			return
		}

		file, header, err := r.FormFile("avatar")
		if err != nil {
			apihttp.WriteError(w, http.StatusBadRequest, "an avatar file is required")
			return
		}
		defer file.Close()

		if header.Size > MaxAvatarSizeBytes {
			apihttp.WriteError(w, http.StatusBadRequest, "avatar exceeds the maximum allowed size")
			return
		}

		plaintext, err := io.ReadAll(file)
		if err != nil {
			apihttp.WriteError(w, http.StatusBadRequest, "could not read the uploaded avatar")
			return
		}

		ciphertext, err := photos.Encrypt(encryptionKey, plaintext)
		if err != nil {
			apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
			return
		}

		if err := store.Put(r.Context(), objectKeyForUser(userID), ciphertext); err != nil {
			apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
			return
		}

		apihttp.WriteJSON(w, http.StatusOK, struct{}{})
	})
}

// DownloadAvatarHandler descifra y devuelve los bytes del avatar de la
// cuenta autenticada. Devuelve 404 si la cuenta no tiene ningún avatar
// configurado — nunca genera ni redirige a una URL directa del
// almacenamiento subyacente (mismo criterio que photos.DownloadHandler).
func DownloadAvatarHandler(store photos.BlobStore, encryptionKey []byte) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := apihttp.RequireUserID(w, r)
		if !ok {
			return
		}

		serveAvatarBlob(w, r, store, encryptionKey, userID, avatarNotFoundMessage)
	})
}

// DownloadUserAvatarHandler descifra y devuelve los bytes del avatar de la
// cuenta identificada por el username de la ruta — exige sesión activa
// (cualquier cuenta autenticada, no solo la propia), pero no revela si el
// 404 es por username inexistente o por cuenta sin avatar (ver
// avatarNotFoundMessage).
func DownloadUserAvatarHandler(userStore auth.UserStore, blobStore photos.BlobStore, encryptionKey []byte) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := apihttp.RequireUserID(w, r); !ok {
			return
		}

		username := chi.URLParam(r, "username")
		user, err := userStore.FindUserByUsername(r.Context(), username)
		if err != nil {
			apihttp.WriteError(w, http.StatusNotFound, avatarNotFoundMessage)
			return
		}

		serveAvatarBlob(w, r, blobStore, encryptionKey, user.ID, avatarNotFoundMessage)
	})
}

// serveAvatarBlob descifra y escribe el avatar almacenado para userID, o el
// mensaje de 404 indicado si no tiene ninguno — lógica común a
// DownloadAvatarHandler (la propia cuenta) y DownloadUserAvatarHandler (una
// cuenta ajena, ver selector-amigos), que solo difieren en cómo resuelven
// userID.
func serveAvatarBlob(w http.ResponseWriter, r *http.Request, store photos.BlobStore, encryptionKey []byte, userID int64, notFoundMessage string) {
	ciphertext, err := store.Get(r.Context(), objectKeyForUser(userID))
	if err != nil {
		if err == photos.ErrObjectNotFound {
			apihttp.WriteError(w, http.StatusNotFound, notFoundMessage)
			return
		}
		apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
		return
	}

	plaintext, err := photos.Decrypt(encryptionKey, ciphertext)
	if err != nil {
		apihttp.WriteError(w, http.StatusInternalServerError, "could not process the request")
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(plaintext)
}

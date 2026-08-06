package auth

import "fmt"

// Colores copiados de apps/mobile/src/shared/styles/tokens.css ("Asfalto
// Nocturno") — apps/api no puede importar ese fichero (paquetes de build
// independientes, sin pipeline compartido). Si la paleta cambia ahí, hay que
// actualizar estos valores a mano. Compartido por todas las páginas HTML
// servidas por apps/api (reset de contraseña, verificación de email).
const authPageCSS = `
  :root { color-scheme: dark; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, oklch(22% 0.018 50), oklch(14% 0.014 50));
    font-family: "Barlow", "Segoe UI", sans-serif;
    color: oklch(92% 0.01 60);
  }
  .panel {
    width: min(90vw, 380px);
    background: oklch(24% 0.018 50);
    border: 1px solid oklch(30% 0.02 50);
    border-radius: 14px;
    padding: 32px 28px;
    box-sizing: border-box;
  }
  h1 {
    font-family: "Roboto Slab", "Georgia", serif;
    font-size: 1.4rem;
    margin: 0 0 16px;
  }
  p { color: oklch(70% 0.015 55); line-height: 1.5; }
  label { display: block; margin: 16px 0 6px; font-weight: 600; }
  input[type="password"] {
    width: 100%;
    box-sizing: border-box;
    padding: 12px;
    min-height: 44px;
    border-radius: 8px;
    border: 1px solid oklch(30% 0.02 50);
    background: oklch(20% 0.016 50);
    color: oklch(92% 0.01 60);
    font-size: 1rem;
  }
  button {
    margin-top: 24px;
    width: 100%;
    min-height: 56px;
    border-radius: 999px;
    border: none;
    background: oklch(74% 0.17 48);
    color: oklch(14% 0.014 50);
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
  }
  button:hover { background: oklch(58% 0.17 45); }
  .error {
    color: oklch(55% 0.18 30);
    font-weight: 600;
    margin: 0 0 8px;
  }
`

// authPageShell envuelve bodyHTML (ya renderizado, y ya escapado si viene de
// html/template) en el documento HTML completo compartido por las páginas de
// apps/api — doctype, cabecera, CSS y el panel centrado. title es siempre un
// literal fijo del propio código, nunca input de usuario.
func authPageShell(title, bodyHTML string) []byte {
	return []byte(fmt.Sprintf(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>%s</title>
  <style>%s</style>
</head>
<body>
  <main class="panel">
%s
  </main>
</body>
</html>
`, title, authPageCSS, bodyHTML))
}

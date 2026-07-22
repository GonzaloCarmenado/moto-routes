---
description: Revisa la implementación de un feature contra su spec original (CRÍTICO + veredicto)
argument-hint: <nombre-feature>
---

Invoca al subagente `review-agent` (Agent tool, subagent_type: review-agent) para revisar la implementación del feature `$ARGUMENTS` contra `specs/features/$ARGUMENTS.md`.

El agente debe generar `specs/features/$ARGUMENTS.review.md` con ficheros tocados, cumplimiento de AC, sección CRÍTICO (seguridad, componentes compartidos, actualizaciones core, normas saltadas) y veredicto final. Muestra el veredicto y la sección CRÍTICO íntegros en tu respuesta al usuario.

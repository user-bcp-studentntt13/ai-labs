# Plan

## Componente web

### Aprobacion humana
-Erick
-2026/10/26
- H-WEB-01, H-WEB-02, H-WEB-03, H-WEB-04, H-WEB-05, H-WEB-06

### Alcance y estado

La selección aprobada por Erick el `2026/10/26` comprende H-WEB-01 a H-WEB-06, según el registro de aprobación al inicio de este plan. Se cubrieron sesión y renderizado, revisión de dependencias, responsabilidades, tipado y pruebas.

`docs/ENDPOINTS.md` no existe. Se preservará el comportamiento observado en `HALLAZGOS.md`: `POST /auth/login` con `username`, `password` y `client`; el login solo avanza si recibe `data.token`; dashboard consulta `GET /api/tasks?owner=<username>` con `Authorization: Bearer <token>`; las tareas archivadas no se muestran; logout elimina token y usuario y navega a `/login`. No se cambiarán endpoints, payloads, cabeceras ni rutas.

Las pruebas actuales usan Vitest con entorno `node` (`web/vitest.config.ts`), por lo que se proponen pruebas unitarias directas con dobles de almacenamiento, Axios y Router. No se presupone DOM real ni se propone añadir una dependencia de test.

### H-WEB-01 — Token en localStorage

- **Hallazgo inicial:** Token de sesión persistido en `localStorage` (`HALLAZGOS.md`, H-WEB-01; resuelto).
- **Problema:** Scripts ejecutados en el mismo origen pueden leer el token. El código confirma persistencia en almacenamiento accesible a JavaScript; no confirma un XSS explotable.
- **Cambio propuesto:** Centralizar lectura, escritura y eliminación de token/usuario en un `SessionService`. Se eligió `sessionStorage` para limitar persistencia al contexto de la pestaña; sigue siendo accesible a JavaScript y no elimina el riesgo ante XSS. Se mantuvieron el flujo login → dashboard, la cabecera Bearer y el cierre de sesión. No se movió ningún secreto de backend al frontend ni se migró a cookie HttpOnly.
- **Archivos a tocar:** `web/src/app/login/login.component.ts`, `web/src/app/dashboard/dashboard.component.ts`; nuevo `web/src/app/services/session.service.ts`; pruebas de login, dashboard y sesión bajo `web/src/app/`.
- **Caracterización antes del cambio:** Escribir pruebas que comprueben login correcto con almacenamiento del usuario/token, uso del token en la petición de tareas, redirección si falta token y logout que limpia la sesión y navega a login. No fijar el almacenamiento concreto como contrato HTTP. Añadir caso para la persistencia limitada elegida antes de modificar el mecanismo.
- **Riesgo residual:** Al cerrar la pestaña termina la sesión; una XSS todavía podría leer el token mientras la pestaña está abierta. La aprobación registrada cubre H-WEB-01, pero no contiene una nota separada sobre esta duración.

### H-WEB-02 — Mensaje dinámico con innerHTML

- **Hallazgo inicial:** `message` se renderizaba mediante `[innerHTML]` (`HALLAZGOS.md`, H-WEB-02; resuelto).
- **Problema:** El contenido combina nombre y mensaje de error dinámicos con markup. Angular normalmente sanitiza el binding, por lo que no se da por demostrada una explotación.
- **Cambio propuesto:** Construir mensajes como texto plano y renderizarlos mediante interpolación. Separar el texto visible de cualquier formato HTML; no usar `DomSanitizer` ni confiar HTML del backend.
- **Archivos a tocar:** `web/src/app/login/login.component.ts`, `web/src/app/login/login.component.html` y `web/src/app/login/login.component.spec.ts`.
- **Caracterización antes del cambio:** Probar que errores de validación y de autenticación muestran el texto esperado, incluido el mensaje recibido, y que no alteran el flujo de login. Como Vitest está en entorno `node`, esta prueba caracteriza el texto producido, no la sanitización del DOM; comprobar el binding final con build y revisión del template.

### H-WEB-03 — Revisión SCA de Axios y lodash

- **Hallazgo inicial:** Versiones declaradas `axios` y `lodash` candidatas a revisión (`HALLAZGOS.md`, H-WEB-03; resuelto para dependencias directas).
- **Problema:** No se ha comprobado si las versiones tienen advisories aplicables ni el impacto en el uso del cliente.
- **Cambio propuesto:** Ejecutar la auditoría configurada y revisar advisories/alcance antes de decidir actualizar, reemplazar o retirar cada paquete. Se actualizó Axios a `1.20.0` y se retiró lodash al sustituir su único uso con spread nativo; no se agregaron dependencias.
- **Archivos a tocar:** Solo si la evidencia lo requiere: `web/package.json` y `web/package-lock.json`; pruebas de caracterización pertinentes en `web/src/app/`.
- **Caracterización antes del cambio:** Añadir/confirmar pruebas del payload y URL del login, la cabecera y URL de tareas, y la combinación de preferencias que hoy usa `lodash/merge`. Ejecutar el baseline de pruebas y build antes de cambiar dependencias. La auditoría es una comprobación de advisories, no una prueba de comportamiento.
- **Comprobación posterior:** `npm run audit:workshop` sigue fallando por 23 avisos en Angular/tooling/transitivas; las referencias directas de Axios y lodash ya no aparecen en el reporte final. No se ejecutó `npm audit fix --force` porque propone saltos de Angular/tooling fuera de alcance.

### H-WEB-04 — Responsabilidades mezcladas en componentes

- **Hallazgo inicial:** Componentes gestionaban HTTP, sesión, URLs y navegación (`HALLAZGOS.md`, H-WEB-04; resuelto).
- **Problema:** Cambios de transporte o sesión afectan directamente a componentes de UI y dificultan probar cada responsabilidad.
- **Cambio propuesto:** Extraer la autenticación a `AuthService`, el estado de sesión a `SessionService` y la consulta a `TasksService`; centralizar URLs en configuración Angular ya existente o en una configuración de entorno acotada. Los componentes conservan validación de presentación, estado visual y navegación. Mantener exactamente las rutas, payloads, query `owner` y cabecera Bearer observados.
- **Archivos a tocar:** `web/src/app/login/login.component.ts`, `web/src/app/dashboard/dashboard.component.ts`; nuevos servicios bajo `web/src/app/services/`; archivo de configuración de entorno solo si se necesita centralizar URLs; pruebas bajo `web/src/app/`.
- **Caracterización antes del cambio:** Probar la llamada login (URL, body y timeout), el GET de tareas (URL/query y Authorization), las rutas de éxito/error, el redireccionamiento sin token y logout. Después, mover la misma conducta a servicios sin cambiar el contrato observado.

### H-WEB-05 — any y condicionales anidados

- **Hallazgo inicial:** Tipos `any` y validación anidada; no se confirmó duplicación (`HALLAZGOS.md`, H-WEB-05; problemas confirmados resueltos).
- **Problema:** `any` oculta incompatibilidades del request/response y de tareas; la validación anidada dificulta seguir los caminos de error. No se extraerá código duplicado sin evidencia concreta.
- **Cambio propuesto:** Definir tipos/interfaces para request/response de login, usuario y tarea; manejar errores externos como `unknown` y normalizarlos en un punto; usar guard clauses para campos faltantes. Extraer funciones solo cuando una responsabilidad o duplicación real lo justifique. Mantener el filtrado de `ARCHIVED`, etiquetas, orden y mensajes observados.
- **Archivos a tocar:** `web/src/app/login/login.component.ts`, `web/src/app/dashboard/dashboard.component.ts`, `web/src/app/utils/legacy-format.ts`; tipos nuevos solo si no encajan localmente; pruebas correspondientes bajo `web/src/app/`.
- **Caracterización antes del cambio:** Cubrir usuario/contraseña vacíos, respuesta de login sin token, errores HTTP, tareas archivadas y visibles, etiquetas para prioridad/owner ausentes y orden actual por prioridad. Incluir los casos existentes de `formatTaskLabel` para evitar alterar su salida.

### H-WEB-06 — Pruebas limitadas a una utilidad

- **Hallazgo inicial:** La única especificación encontrada cubría `formatTaskLabel` (`HALLAZGOS.md`, H-WEB-06; resuelto).
- **Problema:** El flujo login, persistencia de sesión, estados de tareas y logout no tienen pruebas encontradas; una regresión puede romper el recorrido sin detectarse.
- **Cambio propuesto:** Ampliar pruebas Vitest de forma incremental para login, servicios, dashboard y sesión, reutilizando dobles y helpers cuando eviten duplicación. Cubrir éxito, validación, error, token ausente, filtrado de archivadas y logout. No cambiar la configuración de entorno ni añadir dependencias salvo que una prueba requerida demuestre que son necesarias.
- **Archivos a tocar:** Nuevos `*.spec.ts` bajo `web/src/app/` y utilidades de prueba en `web/src/` solo si se reutilizan; no modificar producción únicamente para facilitar un test sin justificación.
- **Caracterización antes del cambio:** Se añadieron pruebas de los comportamientos actuales descritos en H-WEB-01, H-WEB-02, H-WEB-04 y H-WEB-05; baseline completo: 10 pruebas pasaron. La cobertura final fue superior al 85% en métricas globales y en cada módulo productivo modificado. Los comandos y resultados quedan en este registro; `docs/TESTING.md` no se crea en este paso.

## Secuencia propuesta

1. Aprobación humana registrada para H-WEB-01 a H-WEB-06.
2. Se escribieron y ejecutaron pruebas de caracterización antes de modificar producción.
3. Se implementaron seguridad de mensajes, sesión centralizada, servicios, configuración, tipos y pruebas sin cambiar los endpoints/payloads observados.
4. La auditoría justificó actualizar Axios y retirar lodash; las alertas restantes requieren un plan aparte porque sus fixes propuestos actualizan tooling fuera del alcance.
5. Se ejecutaron suite, cobertura, build y auditoría final. Los estados de HALLAZGOS.md se actualizaron con resultados y riesgos residuales.

## Registro de ejecuciones — web

| ejecución | IDs | comando | resultado |
|---|---|---|---|
| Caracterización inicial de login | H-WEB-01, H-WEB-02, H-WEB-04, H-WEB-05 | `npm test -- src/app/login/login.component.spec.ts` (cwd `web/`) | Primer intento no llegó a ejecutar tests por falta de carga JIT de Angular; se importó el compilador ya instalado. Repetición: 5/5 pasaron antes del cambio de producción. |
| Caracterización inicial de dashboard | H-WEB-01, H-WEB-04, H-WEB-05 | `npm test -- src/app/dashboard/dashboard.component.spec.ts` (cwd `web/`) | Primera expectativa de orden falló; el código existente compara prioridades como strings y ordena `LOW` antes de `HIGH`. Corregida la expectativa para caracterizar el comportamiento real; repetición: 4/4 pasaron antes de producción. |
| Baseline de suite | H-WEB-01 a H-WEB-06 | `npm test` (cwd `web/`) | 10/10 pasaron. |
| Baseline de compilación | H-WEB-01 a H-WEB-06 | `npm run build` (cwd `web/`) | Build correcto; advertencias CommonJS de Axios y lodash antes de resolver H-WEB-03. |
| Auditoría previa | H-WEB-03 | `npm run audit:workshop` (cwd `web/`) | Exit 1; 25 advisories (10 moderados, 9 altos, 6 críticos), incluyendo Axios y lodash. |
| Actualización de dependencias | H-WEB-03 | `npm install axios@1.20.0 lodash@4.18.1 --save-exact` (cwd `web/`) | Primer intento falló en npm Arborist sin cambiar manifests. Reintento con `--legacy-peer-deps` resolvió dependencias. Luego lodash se eliminó con `npm uninstall lodash --legacy-peer-deps`; se conservó el diff preexistente del lockfile. |
| Suite tras actualización directa | H-WEB-03 | `npm test` (cwd `web/`) | 10/10 pasaron tras actualizar Axios/antes de ampliar las pruebas. |
| Caracterización de texto plano | H-WEB-02 | `npm test -- src/app/login/login.component.spec.ts` (cwd `web/`) | 5/5 pasaron después de sustituir `[innerHTML]` por interpolación. |
| Sesión y servicios | H-WEB-01, H-WEB-04, H-WEB-05 | `npm test -- src/app/services/session.service.spec.ts src/app/login/login.component.spec.ts src/app/dashboard/dashboard.component.spec.ts` (cwd `web/`) | 12/12 pasaron tras centralizar sesión y extraer servicios. |
| Suite ampliada | H-WEB-01 a H-WEB-06 | `npm test` (cwd `web/`) | 18/18 pasaron; incluía preferencias, errores, estados y formateo. |
| Build tras refactor | H-WEB-01, H-WEB-02, H-WEB-04, H-WEB-05 | `npm run build` (cwd `web/`) | Primer intento señaló tipo `SessionUser` obsoleto; corregido a `AuthenticatedUser`. Repetición pasó. |
| Caracterización de dashboard ampliada | H-WEB-04, H-WEB-05, H-WEB-06 | `npm test -- src/app/dashboard/dashboard.component.spec.ts` (cwd `web/`) | 6/6 pasaron tras cubrir owner/prioridad ausentes y error de red. |
| Suite final | H-WEB-01 a H-WEB-06 | `npm test` (cwd `web/`) | 20/20 pasaron en 5 archivos. |
| Cobertura final | H-WEB-01 a H-WEB-06 | `npm run test:coverage` (cwd `web/`) | 20/20 pasaron; global: 88.21% statements/líneas, 92.30% ramas, 90.9% funciones. Dashboard: 100% líneas, 94.73% ramas; login: 97.18% líneas, 86.66% ramas; servicios: 98.36% líneas, 94.73% ramas; utilidades: 100%. |
| Build final | H-WEB-01 a H-WEB-06 | `npm run build` (cwd `web/`) | Correcto, sin advertencias CommonJS tras retirar lodash y actualizar Axios. |
| Auditoría final | H-WEB-03 | `npm run audit:workshop` (cwd `web/`) | Exit 1; 23 advisories (10 moderados, 7 altos, 6 críticos) en Angular, Vitest, Vite y dependencias transitivas/tooling. No se amplió el alcance con `--force`. |

### Seguimiento de pruebas — 2026/10/26

| ejecución | IDs | comando | resultado |
|---|---|---|---|
| Ampliación enfocada | H-WEB-06 | `npm test -- src/app/login/login.component.spec.ts src/app/dashboard/dashboard.component.spec.ts` (cwd `web/`) | Exit 0; 19/19 pruebas enfocadas, incluyendo flujo login→tareas, servicio auth no disponible, token inválido, timeout y respuestas inesperadas. |
| Suite actualizada | H-WEB-06 | `npm test` (cwd `web/`) | Exit 0; 28/28 pruebas en 5 archivos. |
| Cobertura actualizada | H-WEB-06 | `npm run test:coverage` (cwd `web/`) | Exit 0; V8: login+dashboard 141/143 líneas (98.60%); global 232/263 (88.21%). Método y desglose en `docs/TESTING.md`. |
| Invocaciones con cwd incorrecto | H-WEB-06 | `npm test -- ...` y `npm test` desde la raíz | Exit 1 por no encontrar `package.json` en la raíz; no ejecutaron Vitest. Se repitieron desde `web/` y pasaron; detalle en `docs/TESTING.md`. |

Las referencias anteriores a que `docs/ENDPOINTS.md` no existía y a no crear todavía `docs/TESTING.md` describen el estado del plan antes de esos entregables; ambos documentos existen ahora para web.

La cobertura global incluye archivos no modificados sin cobertura; los módulos productivos modificados superan 85% de líneas. No se ejecutaron solicitudes contra los servicios ni una prueba de navegador/DOM. La sesión `sessionStorage` sigue accesible a JavaScript y termina al cerrar la pestaña.

# Endpoints consumidos por web

## Alcance del contrato

Esta documentación describe el contrato observado en el cliente Angular, no un contrato acordado ni una verificación de los servicios. `docs/ENDPOINTS.md` no existía al documentarlo y el código revisado se limita a `web/`. Axios resuelve normalmente respuestas HTTP 2xx y rechaza respuestas fuera de su rango de éxito; la aplicación no inspecciona `response.status`, por lo que no se puede confirmar aquí un código de éxito exacto.

## 1. Login — `POST /auth/login`

### 1. Quién lo llama

`LoginComponent.login()` valida los campos y llama a `AuthService.login()`. El servicio hace el POST a `${environment.authApiUrl}/auth/login`; actualmente `authApiUrl` es `http://localhost:8080` (`web/src/app/login/login.component.ts:40-75`; `web/src/app/services/auth.service.ts:6-18`; `web/src/environments/environment.ts:1-4`).

### 2. Qué envía

No se proporciona un objeto de headers propio. El cuerpo se entrega a Axios como objeto y el cliente lo serializa como JSON; la aplicación no modifica explícitamente el `Content-Type`. El timeout configurado para este POST es de 5000 ms.

| Parte | Campo | Tipo/condición observada | Origen |
|---|---|---|---|
| Header | Ninguno configurado explícitamente por `AuthService` | Axios recibe un objeto JSON; el header transmitido efectivo puede depender de la configuración de Axios | `web/src/app/services/auth.service.ts:11-16` |
| Body | `username` | string; el componente no envía si está vacío tras `trim()` | Input de login |
| Body | `password` | string; el componente no envía si está vacío tras `trim()` | Input de contraseña |
| Body | `client` | string constante `angular-workshop` | Constante del componente |
| Opción cliente | `timeout` | 5000 ms; no es un campo del body | `web/src/app/services/auth.service.ts:6,11-15` |

Ejemplo ficticio usado por la caracterización local:

```json
{
  "username": "student",
  "password": "Workshop123!",
  "client": "angular-workshop"
}
```

La contraseña del ejemplo es de laboratorio, no debe sustituirse por una credencial real (`web/src/app/login/login.component.spec.ts:43-62`).

### 3. Qué espera recibir en éxito

El cliente considera exitosa cualquier respuesta que Axios resuelva y cuyo `data.token` sea truthy. No comprueba un status exacto ni valida el objeto de respuesta en runtime. `LoginResponse` tipa `token` y `user` como opcionales; en la práctica el token es obligatorio para continuar. Si falta `user`, el componente crea `{ username: <usuario enviado> }` (`web/src/app/models/auth.models.ts:1-16`; `web/src/app/login/login.component.ts:59-67`).

| Campo | Tipo del cliente | Requerido para continuar | Uso |
|---|---|---|---|
| `token` | string opcional en la interfaz | Sí, debe ser truthy en runtime | Se guarda en la sesión y luego se envía como Bearer al endpoint de tareas |
| `user` | `AuthenticatedUser` opcional | No | Se guarda en la sesión; si falta se usa el username enviado |
| `user.username` | string | Si el objeto `user` viene, lo define la interfaz; el fallback del cliente siempre lo provee | Identidad mostrada y query `owner` |
| `user.displayName` | string opcional | No | Nombre preferido para el saludo del dashboard |
| `user.role` | string opcional | No | Conservado en el objeto de sesión; el cliente no aplica autorización por rol |

Status observado: respuesta 2xx aceptada por Axios; no se puede afirmar si el servicio devuelve específicamente `200` porque el código cliente no lo comprueba. Ejemplo ficticio basado en el fixture de prueba:

```json
{
  "token": "test-token",
  "user": {
    "username": "student",
    "role": "STUDENT"
  }
}
```

`test-token` es un valor de prueba, no un token válido ni una credencial (`web/src/app/login/login.component.spec.ts:44-50`).

### 4. Errores y reacción de la UI

| Caso | Reacción observada |
|---|---|
| Usuario vacío tras `trim()` | No hace solicitud; muestra `Ingrese un usuario.` |
| Contraseña vacía tras `trim()` | No hace solicitud; muestra `Ingrese una contraseña.` |
| Respuesta resuelta sin `token` | No navega ni guarda una sesión nueva; muestra `El backend respondió sin token.` |
| Error HTTP, incluidas credenciales inválidas | Axios rechaza la promesa. La UI muestra el título `No se pudo autenticar a <username>.` y como detalle usa `response.data.message` si es string; en su defecto `error.message`, o `Error desconocido`. El componente registra además el objeto de error con `console.error` y siempre vuelve `busy` a `false`. El código no distingue 401 de otros estados HTTP. |
| Timeout | Este POST configura 5000 ms. Si Axios rechaza por timeout, la UI usa el `error.message` proporcionado por Axios debajo del título de autenticación; no se define un mensaje específico para timeout. |
| Respuesta inesperada | Si `data` es `null`/inexistente, el acceso a `response.token` puede lanzar y entra al mismo `catch`. Si el objeto existe pero no tiene token, se muestra el mensaje anterior. |
| Token presente, `user` ausente | Se considera éxito, se usa el username enviado como usuario de sesión y navega a `/dashboard`. |

El título y detalle se renderizan con interpolación Angular, no con `[innerHTML]` (`web/src/app/login/login.component.html:39-43`; `web/src/app/utils/api-error.ts:7-23`).

### 5. Notas de seguridad

- Usuario y contraseña viajan en el body, no en la URL. La URL actual está configurada como HTTP localhost para el laboratorio (`web/src/environments/environment.ts:1-4`); este valor no establece una configuración TLS para otro entorno.
- Token y usuario se centralizan en `SessionService` y se guardan en `sessionStorage`, no en `localStorage`. `sessionStorage` sigue siendo accesible a JavaScript del mismo origen y la sesión termina al cerrar la pestaña (`web/src/app/services/session.service.ts:4-40`).
- Los errores se muestran como texto interpolado, pero el componente también hace `console.error(error)`. La forma concreta del error de Axios puede incluir configuración de solicitud; se debe evitar registrar datos de autenticación en producción (`web/src/app/login/login.component.ts:68-74`).
- No se envía el token al endpoint de login como header; se guarda solo después de recibirlo.

## 2. Tareas — `GET /api/tasks`

### 1. Quién lo llama

`DashboardComponent.ngOnInit()` obtiene token y usuario de `SessionService`; si existe token, llama a `TasksService.getTasks(owner, token)`. El servicio llama a `${environment.tasksApiUrl}/api/tasks`; actualmente el host es `http://localhost:8000` (`web/src/app/dashboard/dashboard.component.ts:44-55`; `web/src/app/services/tasks.service.ts:6-15`; `web/src/environments/environment.ts:1-4`).

### 2. Qué envía

| Parte | Campo | Tipo/condición observada | Origen |
|---|---|---|---|
| Header | `Authorization` | `Bearer <token>` | Token devuelto por login y leído desde `SessionService` |
| Query | `owner` | Username codificado con `encodeURIComponent`; si falta username, se envía vacío | `SessionService.getUser().username` o string vacío |
| Body | Ninguno | GET sin body explícito | `TasksService.getTasks()` |
| Opción cliente | `timeout` | No se configura en `TasksService`; el código no establece un plazo propio | `web/src/app/services/tasks.service.ts:8-14` |

Ejemplo ficticio basado en la prueba local:

```http
GET /api/tasks?owner=student HTTP/1.1
Authorization: Bearer test-token
```

El caso de username ausente produce `?owner=` (`web/src/app/dashboard/dashboard.component.spec.ts:95-119`).

### 3. Qué espera recibir en éxito

El tipo de retorno declarado es `Task[]` y el dashboard itera directamente `response.data`; no hay validación runtime del status ni del schema. Axios resuelve respuestas 2xx; el código no fija un status exacto. Las propiedades del modelo son opcionales (`web/src/app/services/tasks.service.ts:8-15`; `web/src/app/models/task.model.ts:1-8`).

| Campo de tarea | Tipo declarado | Uso del cliente |
|---|---|---|
| `owner` | string opcional | Se usa al construir la etiqueta; si falta se muestra `SIN-ASIGNAR` |
| `priority` | string opcional | Se usa en etiqueta y orden; si falta se muestra `NORMAL` |
| `status` | string opcional | Se filtra exactamente `ARCHIVED` y se convierte a etiqueta visible |
| `title` | string opcional | Título mostrado |
| `description` | string opcional | Descripción mostrada |
| `label` | string opcional, derivado por el cliente | El dashboard lo calcula con prioridad y owner; no necesita venir del servidor |

Ejemplo de arreglo ficticio usado por la caracterización:

```json
[
  {
    "title": "Low",
    "status": "TODO",
    "priority": "LOW",
    "owner": "student"
  }
]
```

`label` se calcula como `LOW · STUDENT`; las tareas con `status: "ARCHIVED"` se excluyen. El orden actual compara `priority` como texto y no define orden de negocio independiente del string (`web/src/app/dashboard/dashboard.component.ts:54-64`; `web/src/app/utils/legacy-format.ts:3-10`).

### 4. Errores y reacción de la UI

| Caso | Reacción observada |
|---|---|
| No hay token en sesión | No hace GET; navega a `/login` y retorna. |
| Token inválido/expirado, 401/403 u otro error HTTP | Si Axios rechaza, la UI usa `response.data.detail` si es string; luego `error.message`; si ninguno existe muestra `No se pudo cargar el dashboard`. Se apaga `loading` y se muestra el párrafo de error; la grilla se oculta. El componente no borra token ni redirige automáticamente, incluso ante 401. |
| Timeout o error de red | El servicio no configura timeout propio. Si la petición rechaza (por timeout configurado globalmente, desconexión u otro fallo), se procesa con la misma prioridad de `detail`, `error.message` y texto genérico; termina la carga. El plazo efectivo no está especificado por este componente. |
| 2xx con arreglo vacío | La grilla muestra `No hay tareas para mostrar todavía.` |
| 2xx con campos opcionales ausentes | Continúa el render: etiqueta usa `NORMAL · SIN-ASIGNAR`, estado desconocido se muestra como texto original y campos de título/descripción vacíos aparecen sin contenido. |
| 2xx con cuerpo que no sea iterable como `Task[]` | No se valida el schema; el `for...of` puede lanzar. El `catch` muestra el mensaje de error normalizado y oculta la grilla. |

El cuerpo de error esperado no está formalizado por el cliente; `detail` es solo el campo que el dashboard intenta leer (`web/src/app/utils/api-error.ts:7-23`).

### 5. Notas de seguridad

- El token va en `Authorization`, no en la URL. El valor se almacena en `sessionStorage`, accesible a JavaScript; cerrar sesión elimina token y usuario (`web/src/app/services/session.service.ts:9-40`).
- `owner` se deriva del objeto de usuario guardado en el navegador y se envía como query. El cliente no puede demostrar que el servidor autorice ese owner contra la identidad del token; esa garantía debe confirmarse en el servicio, fuera del alcance de esta documentación.
- Los errores se interpolan como texto en dashboard. No se usa `[innerHTML]` para datos dinámicos en estas vistas (`web/src/app/dashboard/dashboard.component.html:15-24`).
- No hay timeout específico para esta llamada ni retry configurado por `TasksService`.

## Preguntas abiertas

- ¿Qué status de éxito exacto y schema completo garantizan los servicios? El cliente solo asume respuestas 2xx y usa tipos TypeScript sin validación runtime.
- ¿Qué status y shape de error garantizan login y tareas? El cliente lee `message` para login y `detail` para tareas, pero no se pudo verificar el servidor desde el alcance web.
- ¿El endpoint de tareas limita `owner` al principal autenticado? El cliente envía el query y el Bearer, pero no puede verificar autorización server-side.
- ¿Qué timeout efectivo aplica a GET de tareas? `TasksService` no lo fija y no se vio configuración global de Axios en el cliente revisado.

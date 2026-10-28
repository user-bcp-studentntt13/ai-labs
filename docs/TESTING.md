# Pruebas — web

## Alcance

Suite de cliente para el contrato descrito en [docs/ENDPOINTS.md](ENDPOINTS.md). Se ampliaron únicamente pruebas bajo `web/`; no se modificó código productivo ni se añadieron dependencias. Las pruebas usan Vitest en entorno `node` y mocks de Axios, almacenamiento, router y zona Angular; no hacen solicitudes reales ni prueban renderizado DOM (`web/vitest.config.ts:4-10`). Casos asociados al hallazgo H-WEB-06.

## Casos

| flujo | caso | tipo | resultado esperado |
|---|---|---|---|
| Login → tareas | Credenciales válidas; guarda token, navega y el dashboard consulta tareas con usuario y Bearer | Camino feliz | Se ve la tarea no archivada; termina la carga sin error. |
| Login | Usuario vacío | Borde | Mensaje de validación; no se envía POST. |
| Login | Contraseña vacía o espacios | Borde | Mensaje de validación; no se envía POST. |
| Login | Respuesta sin token | Borde | Mensaje `El backend respondió sin token.`; no guarda sesión ni navega. |
| Login | Body de respuesta nulo | Error de respuesta inesperada | El acceso inesperado se captura; muestra el mensaje de autenticación y libera `busy`. |
| Login | Servicio de autenticación no disponible | Error de red | Muestra título de autenticación y detalle `Network Error`; no guarda sesión ni navega. |
| Login | Timeout del POST (5000 ms configurados) | Error de timeout | Muestra el mensaje de timeout y libera `busy`. |
| Tareas | Token ausente antes del GET | Borde de sesión | No hace GET; navega a `/login`. |
| Tareas | Token inválido; respuesta 401 con `detail` | Error de autenticación | Muestra `Invalid token`, termina carga; según el comportamiento observado no borra sesión ni redirige. |
| Tareas | Timeout del GET | Error de timeout | Muestra el mensaje de error y termina carga. `TasksService` no fija duración propia. |
| Tareas | Body exitoso no iterable como lista | Error de respuesta inesperada | El fallo de iteración se captura, muestra error y termina carga. |
| Tareas | Respuesta HTTP rechazada con `detail` | Error del servicio | Muestra el detalle recibido y termina carga. |
| Tareas | Tareas archivadas, prioridad y owner ausentes | Borde de datos | Excluye `ARCHIVED`; aplica etiquetas por defecto y conserva el resultado observado. |

Los casos principales están en `web/src/app/login/login.component.spec.ts:35-174` y `web/src/app/dashboard/dashboard.component.spec.ts:35-253`. Los nombres y resultados están ligados al contrato del cliente; los mocks no acreditan disponibilidad ni respuestas reales del backend.

## Código de los tests

Los siguientes tests ejecutados se encuentran completos en las especificaciones enlazadas arriba. Comparten el setup de mocks de Axios y storage presente en esos archivos.

Camino feliz de login y consulta (`web/src/app/dashboard/dashboard.component.spec.ts:45-78`):

```typescript
it('logs in successfully and then loads tasks with the new session', async () => {
  vi.mocked(axios.post).mockResolvedValue({
    data: { token: 'test-token', user: { username: 'student' } }
  } as never);
  vi.mocked(axios.get).mockResolvedValue({
    data: [{ title: 'First task', status: 'TODO', priority: 'HIGH', owner: 'student' }]
  } as never);
  const loginRouter = { navigate: vi.fn().mockResolvedValue(true) };
  const login = new LoginComponent(loginRouter as never, new AuthService(), new SessionService());
  login.username = 'student';
  login.password = 'Workshop123!';

  await login.login();

  const dashboardRouter = { navigate: vi.fn().mockResolvedValue(true) };
  const dashboard = new DashboardComponent(
    dashboardRouter as never,
    { detectChanges: vi.fn() } as never,
    { run: (callback: () => void) => callback() } as never,
    new SessionService(),
    new TasksService()
  );
  await dashboard.ngOnInit();

  expect(loginRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
  expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
    headers: { Authorization: 'Bearer test-token' }
  });
  expect(dashboard.visibleTasks.map((task: { title: string }) => task.title)).toEqual(['First task']);
  expect(dashboard.error).toBe('');
  expect(dashboard.loading).toBe(false);
});
```

Bordes de credenciales y token ausente (`web/src/app/login/login.component.spec.ts:75-100`):

```typescript
it.each([
  { username: '', password: 'Workshop123!', message: { title: 'Ingrese un usuario.' } },
  { username: 'student', password: '', message: { title: 'Ingrese una contraseña.' } },
  { username: 'student', password: ' ', message: { title: 'Ingrese una contraseña.' } }
])('rejects missing credentials before making a request', async ({ username, password, message }) => {
  const router = { navigate: vi.fn().mockResolvedValue(true) };
  const component = new LoginComponent(router as never, new AuthService(), new SessionService());
  component.username = username;
  component.password = password;

  await component.login();

  expect(component.message).toEqual(message);
  expect(axios.post).not.toHaveBeenCalled();
});

it('shows the existing message when the response has no token', async () => {
  vi.mocked(axios.post).mockResolvedValue({ data: { user: { username: 'student' } } } as never);
  const router = { navigate: vi.fn() };
  const component = new LoginComponent(router as never, new AuthService(), new SessionService());
  component.username = 'student';
  component.password = 'Workshop123!';

  await component.login();

  expect(component.message).toEqual({ title: 'El backend respondió sin token.' });
  expect(storedSessionValues.size).toBe(0);
  expect(router.navigate).not.toHaveBeenCalled();
});
```

Servicio de autenticación no disponible y timeout (`web/src/app/login/login.component.spec.ts:135-174`):

```typescript
it('shows an unavailable authentication service without creating a session', async () => {
  vi.mocked(axios.post).mockRejectedValue(new Error('Network Error'));
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const router = { navigate: vi.fn() };
  const component = new LoginComponent(router as never, new AuthService(), new SessionService());
  component.username = 'student';
  component.password = 'Workshop123!';

  await component.login();

  expect(component.message).toEqual({
    title: 'No se pudo autenticar a student.',
    detail: 'Network Error'
  });
  expect(component.busy).toBe(false);
  expect(storedSessionValues.size).toBe(0);
  expect(router.navigate).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

it('shows the timeout message and always resets the busy state', async () => {
  vi.mocked(axios.post).mockRejectedValue(new Error('timeout of 5000ms exceeded'));
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const component = new LoginComponent({ navigate: vi.fn() } as never, new AuthService(), new SessionService());
  component.username = 'student';
  component.password = 'Workshop123!';

  await component.login();

  expect(component.message).toEqual({
    title: 'No se pudo autenticar a student.',
    detail: 'timeout of 5000ms exceeded'
  });
  expect(component.busy).toBe(false);
  consoleError.mockRestore();
});
```

Token inválido y timeout de tareas (`web/src/app/dashboard/dashboard.component.spec.ts:194-232`):

```typescript
it('shows an invalid-token response without clearing the session or redirecting', async () => {
  storedSessionValues.set('workshop_token', 'invalid-token');
  storedSessionValues.set('workshop_user', JSON.stringify({ username: 'student' }));
  vi.mocked(axios.get).mockRejectedValue({
    response: { status: 401, data: { detail: 'Invalid token' } }
  });
  const router = { navigate: vi.fn() };
  const component = new DashboardComponent(
    router as never,
    { detectChanges: vi.fn() } as never,
    { run: (callback: () => void) => callback() } as never,
    new SessionService(),
    new TasksService()
  );

  await component.ngOnInit();

  expect(component.error).toBe('Invalid token');
  expect(component.loading).toBe(false);
  expect(storedSessionValues.get('workshop_token')).toBe('invalid-token');
  expect(router.navigate).not.toHaveBeenCalled();
});

it('shows a tasks request timeout and ends loading', async () => {
  storedSessionValues.set('workshop_token', 'test-token');
  vi.mocked(axios.get).mockRejectedValue(new Error('timeout exceeded'));
  const component = new DashboardComponent(
    { navigate: vi.fn() } as never,
    { detectChanges: vi.fn() } as never,
    { run: (callback: () => void) => callback() } as never,
    new SessionService(),
    new TasksService()
  );

  await component.ngOnInit();

  expect(component.error).toBe('timeout exceeded');
  expect(component.loading).toBe(false);
});
```

Respuesta inesperada del endpoint de tareas (`web/src/app/dashboard/dashboard.component.spec.ts:234-252`):

```typescript
it('shows an error and ends loading when the tasks body is not iterable', async () => {
  storedSessionValues.set('workshop_token', 'test-token');
  vi.mocked(axios.get).mockResolvedValue({ data: { unexpected: true } } as never);
  const component = new DashboardComponent(
    { navigate: vi.fn() } as never,
    { detectChanges: vi.fn() } as never,
    { run: (callback: () => void) => callback() } as never,
    new SessionService(),
    new TasksService()
  );

  await component.ngOnInit();

  expect(component.error).toMatch(/iterable/i);
  expect(component.loading).toBe(false);
});
```

El caso del body de login `null` también está cubierto en `web/src/app/login/login.component.spec.ts:103-117`.

## Ejecuciones

Comandos ejecutados desde `web/` (PowerShell cambió el directorio con `Push-Location web` y propagó `$LASTEXITCODE`). El reporte V8 se configuró en `web/vitest.config.ts:7-10` y se generó en `web/coverage/`.

| comando | directorio | salida | resultado real |
|---|---|---:|---|
| `npm test -- src/app/login/login.component.spec.ts src/app/dashboard/dashboard.component.spec.ts` | `web/` | 0 | Baseline previo: 2 archivos, 11/11 pruebas. |
| `npm test -- src/app/login/login.component.spec.ts src/app/dashboard/dashboard.component.spec.ts` | `web/` | 0 | Tras primera ampliación: 2 archivos, 17/17 pruebas. |
| `npm test -- src/app/login/login.component.spec.ts src/app/dashboard/dashboard.component.spec.ts` | `web/` | 0 | Final tras añadir respuestas inesperadas: 2 archivos, 19/19 pruebas. |
| `npm test` | `web/` | 0 | Suite final: 5 archivos, 28/28 pruebas. |
| `npm run test:coverage` | `web/` | 0 | Suite final: 5 archivos, 28/28 pruebas; reporter V8 text/json-summary/html. |

### Cobertura

Método: cobertura de líneas/statements JavaScript/TypeScript instrumentada por V8 a través de `@vitest/coverage-v8`; numerador/denominador tomados de `web/coverage/coverage-summary.json`. No se cuentan archivos `.spec.ts` como código fuente instrumentado.

| ámbito | líneas cubiertas / total | porcentaje |
|---|---:|---:|
| `LoginComponent` asociado a las pruebas modificadas | 69 / 71 | 97.18% |
| `DashboardComponent` asociado a las pruebas modificadas | 72 / 72 | 100% |
| Login + dashboard | 141 / 143 | 98.60% |
| Global web instrumentado | 232 / 263 | 88.21% |

El código productivo bajo prueba supera 85% tanto por módulo como en conjunto. La cobertura global se informa aparte e incluye bootstrap/rutas y otros archivos que no cubren estas pruebas. Métricas globales adicionales del mismo reporte: ramas 75/81 (92.59%) y funciones 20/22 (90.90%).

## Fallos de ejecución

- Dos invocaciones iniciales se lanzaron accidentalmente desde la raíz (`npm test -- ...` y `npm test`) y terminaron con exit 1 porque npm no encontró `C:\Users\Usuario\ai-labs\package.json`. No ejecutaron pruebas. Cada comando se repitió después desde `web/` y pasó; no son fallos de Vitest.
- No hubo fallos en la suite final ni en la generación de cobertura.

## Pendientes

- No se hicieron solicitudes HTTP reales; disponibilidad, status y payloads efectivos de auth/API no se certifican con estos mocks.
- No se probaron templates en DOM/navegador: Vitest usa `environment: 'node'`.
- El timeout del GET se simula como rechazo; el servicio no configura timeout propio. Duración efectiva y comportamiento de integración siguen pendientes.
- El caso 401 confirma la reacción documentada del cliente: muestra el error y conserva sesión sin redirigir. No se decidió aquí cambiar ese comportamiento.

## Pruebas propuestas

- Cuando auth y API estén disponibles localmente, agregar una comprobación de integración del contrato de login y tareas, respetando las rutas, payloads, cabecera y query documentados; registrar comandos, resultados y cualquier servicio no iniciado.
- Si se incorpora un runner de navegador como tarea aprobada, validar visualmente los estados de mensaje, carga, error y lista en los templates. No se añade dependencia en este cambio.

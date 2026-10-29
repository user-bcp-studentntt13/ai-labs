# Design

## Context

Ver [proposal.md](proposal.md) para motivacion y [specs/auth-token/spec.md](specs/auth-token/spec.md) para el contrato normativo.

- `auth/` es un servicio Quarkus 3.27 sobre Java 21. `POST /auth/login` valida credenciales mediante `LegacyDatabase` y actualmente arma la respuesta con `token`, `expiresIn`, `user` y un campo `debug`.
- `LegacyTokenUtil` genera un Base64 de `username|role|expiry|secreto`; el secreto es una constante embebida. El codigo no implementa HMAC ni lee `AUTH_TOKEN_SECRET`, pese a lo descrito en el contexto del Issue #24.
- `LoginRequest` ya contiene `client`, pero el flujo actual no lo valida ni lo incluye en el token. `application.properties` no declara configuracion de firma y `pom.xml` no incluye una biblioteca JWT.
- `AuthResourceTest` solo caracteriza login valido (HTTP 200, usuario y token presente). `docs/ENDPOINTS.md` documenta el cuerpo `username`, `password`, `client`, el resultado 2xx con token y usuario, y el uso posterior del token como Bearer; no fija un codigo exacto de exito ni errores.
- La propuesta documenta que el consumidor existente `api/` valida el formato legado. Esta condicion afecta el despliegue del nuevo formato, pero no autoriza cambios de codigo o pruebas fuera de `auth/`.

## Goals / Non-Goals

**Goals:**

- Emitir desde `auth/` un token firmado con los claims de la spec y mantener `token` como string en la respuesta existente.
- Derivar y validar `client` de la solicitud, y calcular `exp` y `expiresIn` desde una sola duracion y una misma referencia temporal.
- Hacer que la configuracion de firma no tenga un secreto embebido utilizable fuera del laboratorio y evitar exponer token, secreto o password en logs.
- Mantener cambios y pruebas de este cambio dentro de `auth/`; preservar los endpoints y las secciones de otros componentes en documentos generales.

**Non-Goals:**

- Cambiar `api/`, `web/`, sus pruebas o sus contratos HTTP.
- Rediseñar persistencia, credenciales, roles, sesiones, autorizacion general o el resto de la aplicacion.
- Cambiar el cuerpo JSON o los nombres/tipos de `token`, `user` y `expiresIn`.
- Desplegar el nuevo token mientras el consumidor Bearer existente no pueda aceptarlo y aplicar su expiracion.

## Decisiones

### Formato y firma

Usar un JWT compacto firmado (JWS) con algoritmo HMAC-SHA-256 mediante una biblioteca SmallRye/Quarkus compatible con la version gestionada por el BOM del proyecto. Mantener la emision detras de una responsabilidad propia de `auth/`; `AuthResource` conserva la validacion de entrada y credenciales, y delega la creacion del token. No implementar codificacion, firma o parsing criptografico propios.

Alternativas consideradas:

- Conservar el Base64 legado: no es una firma y no puede expresar de forma segura los claims requeridos; descartado.
- Construir un formato propio con HMAC: evita una dependencia, pero obliga a mantener serializacion, verificacion y expiracion propias y no resuelve la compatibilidad del consumidor; descartado.
- Adoptar una biblioteca JWT estándar: elegida por ofrecer semantica interoperable para claims y firma. El artefacto exacto debe alinearse con Quarkus 3.27 y verificarse en `auth/` antes de implementarlo.

La observacion del repositorio prevalece sobre la descripcion tecnica del Issue: el estado actual no es HMAC. El objetivo es satisfacer el contrato de HU-01, no preservar una implementacion HMAC que no esta presente.

### Secreto de firma

Leer el secreto desde la configuracion de Quarkus enlazada a `AUTH_TOKEN_SECRET`, sin valor por defecto en produccion. La ausencia de secreto en produccion debe impedir la emision y preferiblemente fallar al iniciar el servicio, para evitar que el sistema opere silenciosamente con una clave debil. Los perfiles de prueba usan un valor ficticio aislado, nunca una credencial real. La longitud y rotacion de clave deben cumplir los requisitos del algoritmo elegido y quedar documentadas con la configuracion.

Alternativas consideradas: un secreto de laboratorio por defecto simplifica ejecuciones locales, pero aumenta el riesgo de promoverlo accidentalmente; se prefiere configuracion explicita en cada entorno. No se elige almacenamiento de secreto ni proveedor externo en este cambio.

### Claims, cliente y vigencia

El emisor toma `sub` del usuario autenticado, no de un valor de identidad no verificado; toma `client` del campo validado de la solicitud. Rechaza el cliente ausente o blank y normaliza los espacios exteriores antes de emitirlo. Calcula `iat` y `exp` en segundos de epoch desde un reloj inyectable y deriva `expiresIn` de ese mismo intervalo, aplicando la tolerancia de 1 segundo establecida en la spec.

La duracion actual observada es 3600 segundos. Mantenerla durante este cambio evita una alteracion innecesaria de vigencia; hacerla configurable solo se considerara si el requisito existente no puede satisfacerse con esa duracion. Alternativas: lecturas independientes del reloj o un `expiresIn` constante; ambas pueden producir discrepancias y se descartan.

### Compatibilidad y errores

Conservar la ruta, el cuerpo de solicitud, la respuesta exitosa 2xx y los campos existentes documentados. No fijar nuevos codigos ni formas de error para campos no definidos por `docs/ENDPOINTS.md`; las pruebas pueden caracterizar las respuestas actuales sin elevar esos detalles a contratos nuevos. No incluir material sensible en mensajes ni logs.

Un JWT no es compatible con el formato Base64 legado que la propuesta atribuye al consumidor actual `api/`. Como `api/` esta fuera de alcance, la liberacion queda bloqueada hasta que exista una capacidad autorizada y verificada para aceptar el formato nuevo y rechazar expirados. No se debe desplegar una emision JWT que rompa el flujo actual de `/api/tasks`.

Alternativas consideradas: seguir emitiendo el token legado no satisface la spec; cambiar el validador `api/` dentro de este cambio viola el alcance aprobado. Por ello, se mantiene una puerta de despliegue y se solicita un cambio separado si la compatibilidad no se puede lograr sin modificar ese componente.

## Estrategia incremental y pruebas

Antes de cambiar la emision, ampliar las pruebas de caracterizacion en `auth/` para fijar el comportamiento actual del limite HTTP: solicitud existente con `client: "angular-workshop"`, exito 200 con `token`/`user` y `expiresIn`, credenciales invalidas no exitosas y campos obligatorios ausentes sin login exitoso. No fijar mensajes/codigos de error que `docs/ENDPOINTS.md` no garantiza.

Despues de esa caracterizacion, cambiar solo el emisor y la configuracion de `auth/` en incrementos revisables. Las pruebas del componente deben cubrir claims y valores, cliente valido/ausente/blank, coherencia de `expiresIn` con un reloj controlado, login valido y credenciales invalidas; usar una clave de prueba ficticia. Agregar una comprobacion de logs que asegure que token, secreto y password no aparecen. Mantener las pruebas y reportes de cobertura dentro de `auth/`.

La spec tambien exige que un token expirado no autorice una operacion protegida. `auth/` no ofrece actualmente una operacion de validacion protegida y el consumidor esta fuera del alcance; por tanto, una prueba solo de `auth/` puede comprobar la expiracion emitida, pero no demostrar ese rechazo downstream. Registrar esa verificacion como gate de integracion/deploy separado, sin modificar pruebas de `api/` en este cambio.

Orden sugerido:

1. Caracterizar los casos y la respuesta actual de login antes de tocar el flujo critico.
2. Introducir la configuracion explicita del secreto y el emisor estandar con pruebas focalizadas.
3. Verificar todas las pruebas de `auth/`, configuracion de produccion sin secreto y ausencia de valores sensibles en logs.
4. No habilitar el nuevo formato para usuarios hasta confirmar compatibilidad y rechazo de expirados en el consumidor Bearer mediante un cambio/gate autorizado por separado.

## Riesgos / Trade-offs

- [El Issue describe HMAC y `AUTH_TOKEN_SECRET`, pero el codigo usa Base64 y una constante] -> Tratar el codigo y tests actuales como evidencia del estado real; caracterizar antes de reemplazarlo y documentar la discrepancia en la revision.
- [El formato nuevo rompe el consumidor Bearer legado] -> Bloquear el despliegue de la nueva emision hasta disponer de compatibilidad verificada; no ampliar `api/` implicitamente.
- [Secreto ausente, corto o distinto entre instancias impide verificar tokens] -> Fallar cerrado en produccion, documentar el requisito de clave, y validar la misma configuracion en las instancias emisoras/verificadoras antes de liberar.
- [Desfase de reloj hace que tokens parezcan validos o expirados antes de lo esperado] -> Usar segundos de epoch, un reloj controlable en pruebas y tolerancia definida; documentar sincronizacion de reloj como requisito operacional.
- [Pruebas de `auth/` no prueban rechazo de tokens expirados por el consumidor] -> Tratar la verificacion de extremo a extremo como gate externo, no como evidencia cubierta por este cambio.
- [Rollback a la version previa vuelve a emitir tokens legados y no entiende JWT ya emitidos] -> Evitar rollout parcial antes de resolver compatibilidad; si se revierte, restaurar la version/configuracion anterior y requerir nuevo login. La duracion actual acota los tokens previos a 3600 segundos, pero no sustituye el gate de compatibilidad.

## Migration Plan

No requiere migracion de base de datos. Primero desplegar y verificar cualquier soporte de validacion requerido en un cambio separado; luego configurar `AUTH_TOKEN_SECRET` en todos los entornos autorizados y desplegar `auth/`. Si falla la emision o la verificacion, revertir el artefacto de `auth/` y su configuracion a la version anterior. No borrar ni cambiar datos. La version nueva no debe emitir JWT en un entorno donde el consumidor siga dependiendo exclusivamente del formato legado.

## Open Questions

- Confirmar en la etapa de implementacion el artefacto JWT exacto compatible con Quarkus 3.27 y su API de construccion/verificacion; esta seleccion no cambia el contrato ni la arquitectura decidida.
- Confirmar quien autorizara y evidenciara el gate separado de compatibilidad del consumidor Bearer antes del despliegue. Si no existe esa autorizacion, el despliegue queda bloqueado y el alcance debe revisarse antes de implementarlo.
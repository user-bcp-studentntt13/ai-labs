# Proposal

## Why

Issue [#24 - HU-01](https://github.com/user-bcp-studentntt13/ai-labs/issues/24) identifica que el token de `POST /auth/login` no acredita actualmente una identidad y expiracion verificables, y que el valor fijo de firma no protege el flujo. Es necesario establecer un contrato comprobable para identidad, cliente, vigencia y manejo de secretos antes de elegir una tecnica de token.

## What Changes

- Definir los claims obligatorios `sub`, `client`, `iat` y `exp` para tokens emitidos tras un login valido.
- Exigir que `client` provenga de la solicitud, sea validado y quede representado en el token.
- Hacer verificable la coherencia entre `expiresIn` y la vigencia del token, con tolerancia maxima asumida de 1 segundo por precision de segundos.
- Exigir que fuera del laboratorio no se use un secreto embebido por defecto y que el secreto no se exponga en logs.
- Definir escenarios verificables para login valido, credenciales invalidas y token expirado.
- Mantener abierta para la etapa de diseno la decision entre HMAC y una libreria JWT.

## Alcance

- Especificar el comportamiento de emision y vigencia del token en el componente `auth/`.
- Mantener el contrato de solicitud y respuesta observado para `POST /auth/login`; los claims son internos al token y no sustituyen los campos de respuesta.
- Preservar el envio de `username`, `password` y `client` en el cuerpo JSON. El cliente observado envia `client: "angular-workshop"`.

## Fuera de alcance

- Modificar codigo o pruebas de `api/` o `web/`, o cambiar sus endpoints.
- Elegir o implementar la tecnica criptografica, libreria, formato de configuracion o estructura interna.
- Cambiar los codigos HTTP o el formato de error no fijados por el contrato documentado.

## Comportamiento que debe preservarse

- `POST /auth/login` sigue aceptando el cuerpo JSON con `username`, `password` y `client`; un login exitoso sigue siendo una respuesta 2xx con `token` y `user` segun `docs/ENDPOINTS.md`.
- Un login rechazado sigue produciendo una respuesta no exitosa. El contrato documentado no fija el codigo exacto.
- El cliente guarda el token exitoso y lo envia como Bearer a `GET /api/tasks`; la respuesta no cambia el nombre ni el tipo string del campo `token`.
- `expiresIn` ya aparece en la respuesta actual y HU-01 agrega el requisito de coherencia con la expiracion; no se cambia su nombre ni unidad observada (segundos).

## Impact

- Componente objetivo: `auth/`; endpoint protegido: `POST /auth/login`.
- Baseline: `docs/ENDPOINTS.md` documenta el contrato consumido por web; el test actual de auth comprueba HTTP 200, `user.username` y presencia de `token`.
- Riesgo de compatibilidad por resolver antes de aplicar: `api/` valida actualmente el formato legado del Bearer. Esta propuesta no autoriza cambios en `api/`; el diseno debe confirmar que un token nuevo sigue siendo utilizable por el consumidor existente o solicitar una ampliacion de alcance.
- Supuestos verificables para esta especificacion: `client` valido es un string no vacio; `expiresIn` coincide con `exp - iat` con diferencia maxima de 1 segundo. Deben revisarse si el contrato de negocio define reglas mas estrictas.
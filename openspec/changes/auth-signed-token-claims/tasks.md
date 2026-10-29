# Tasks

## 1. Caracterizar el contrato actual de auth

- [x] 1.1 Ampliar `AuthResourceTest` para fijar el login valido con `client: "angular-workshop"` y comprobar HTTP 200, `token` string, forma actual de `user` y `expiresIn` en segundos; verificar con `mvn test` desde `auth/`.
- [x] 1.2 Caracterizar credenciales invalidas y username/password ausentes o blank sin fijar mensajes ni codigos no garantizados por `docs/ENDPOINTS.md`; verificar que los casos siguen siendo no exitosos con `mvn test` desde `auth/`.

## 2. Configurar firma segura

- [x] 2.1 Agregar la dependencia JWT compatible con el BOM de Quarkus 3.27 y verificar que resuelve y compila con `mvn -DskipTests package` desde `auth/`.
- [x] 2.2 Enlazar la configuracion a `AUTH_TOKEN_SECRET` sin fallback de produccion y preparar un valor ficticio aislado para tests; verificar con pruebas que la configuracion de produccion sin secreto impide emitir tokens y que el perfil de test inicia con su clave ficticia usando `mvn test` desde `auth/`.

## 3. Implementar emision y claims

- [x] 3.1 Validar `client` del request (string no blank), conservar `angular-workshop` y rechazar ausente, no-string o blank sin emitir token; verificar cada caso con pruebas de `AuthResourceTest` y `mvn test` desde `auth/`.
- [x] 3.2 Emitir un JWS firmado con `sub` del usuario autenticado y `client` validado; verificar firma y valores de los claims mediante pruebas de auth, y confirmar que la respuesta conserva `token` string y la forma existente de `user` con `mvn test`.
- [x] 3.3 Calcular `iat`, `exp` y `expiresIn` desde el mismo intervalo, conservar la duracion observada de 3600 segundos y permitir un reloj controlado en pruebas; verificar `exp > iat`, duracion positiva y diferencia maxima de 1 segundo con `mvn test` desde `auth/`.
- [x] 3.4 Agregar una prueba auth de un token firmado expirado usando la verificacion JWT seleccionada y comprobar que la verificacion lo rechaza; ejecutar el caso con `mvn test` desde `auth/`.

## 4. Verificar manejo de datos sensibles y calidad

- [x] 4.1 Asegurar que los logs de login valido e invalido no contienen token, secreto ni password; verificar con una prueba de captura de logs usando valores ficticios y `mvn test` desde `auth/`.
- [x] 4.2 Ejecutar `mvn verify` desde `auth/`, revisar el reporte JaCoCo y confirmar al menos 85 % de cobertura en el codigo modificado, sin desactivar tests ni quality gates.
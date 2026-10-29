# Spec Delta

## Purpose

Define the observable contract for tokens issued by login so consumers can identify the authenticated user and client and determine when authorization expires, while preserving the documented login interface.

## ADDED Requirements

### Requirement: Preserve the login HTTP contract
The system MUST preserve the documented `POST /auth/login` JSON request and successful response contract while adding token claims. A successful response MUST remain 2xx and include a string `token`; existing `user` data MUST retain its current shape, and `expiresIn` MUST remain expressed in seconds.

#### Scenario: Existing web login succeeds
- **WHEN** a caller submits the documented `username`, `password`, and `client` JSON fields with valid credentials
- **THEN** the response is 2xx and contains a string `token`, `expiresIn` in seconds, and the existing `user` representation

### Requirement: Include the required identity and time claims
Every token issued after successful authentication MUST contain `sub`, `client`, `iat`, and `exp`. The subject MUST identify the authenticated username, the client claim MUST equal the validated request client, and `iat` and `exp` MUST be epoch timestamps with `exp` later than `iat`.

#### Scenario: Valid login issues a token with minimum claims
- **WHEN** valid credentials and a valid client are submitted
- **THEN** the issued token contains all four claims and their values identify the authenticated user, the submitted client, and a positive validity interval

### Requirement: Validate the requested client
The system MUST obtain `client` from the login request and MUST reject a missing, non-string, or blank client without issuing a token. For this change, a valid client is assumed to be a non-empty string after trimming; the existing value `angular-workshop` MUST remain accepted.

#### Scenario: Existing client is accepted
- **WHEN** a login request contains `client` equal to `angular-workshop` and valid credentials
- **THEN** login succeeds and the token's `client` claim equals `angular-workshop`

#### Scenario: Missing or blank client is rejected
- **WHEN** a login request omits `client` or supplies a non-string or blank value
- **THEN** login is unsuccessful and no token is issued

### Requirement: Keep the advertised lifetime consistent
For every issued token, `expiresIn` MUST be a positive number of seconds and MUST differ from `exp - iat` by no more than 1 second. The one-second tolerance is an explicit assumption for integer-second timestamps and MUST be documented with the resulting contract.

#### Scenario: Lifetime matches token expiration
- **WHEN** a successful login response and its token claims are inspected
- **THEN** `expiresIn` is positive and the absolute difference between `expiresIn` and `exp - iat` is at most 1 second

### Requirement: Reject expired tokens
An expired token MUST NOT authorize access to a protected operation; a request using a token whose `exp` is at or before the current time MUST be rejected without returning protected data.

#### Scenario: Expired token is presented as a Bearer token
- **WHEN** a caller presents an issued token after its `exp` timestamp to a protected operation
- **THEN** authorization is rejected and protected data is not returned

### Requirement: Keep secrets and credentials out of logs
Authentication logs MUST NOT contain the issued token, configured token secret, or submitted password.

#### Scenario: Login events are logged
- **WHEN** successful and unsuccessful login attempts are processed
- **THEN** logs contain none of the raw token, token secret, or submitted password values

### Requirement: Do not use a production default signing secret
Outside the laboratory, token issuance MUST NOT use an embedded default secret. If a default secret is retained for laboratory use, its laboratory-only status MUST be documented, and it MUST NOT be used in production.

#### Scenario: Production configuration has no signing secret
- **WHEN** the service runs outside the laboratory without an explicitly configured signing secret
- **THEN** it does not issue a token signed with an embedded default secret
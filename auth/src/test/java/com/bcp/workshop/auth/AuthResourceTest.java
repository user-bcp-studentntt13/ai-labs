package com.bcp.workshop.auth;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.jose4j.jwa.AlgorithmConstraints;
import org.jose4j.jwa.AlgorithmConstraints.ConstraintType;
import org.jose4j.jwt.JwtClaims;
import org.jose4j.jwt.NumericDate;
import org.jose4j.jwt.consumer.InvalidJwtException;
import org.jose4j.jwt.consumer.JwtConsumerBuilder;
import org.jose4j.keys.HmacKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Handler;
import java.util.logging.LogRecord;
import java.util.logging.Logger;
import java.util.logging.SimpleFormatter;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.instanceOf;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
class AuthResourceTest {
    private static final String LOGIN_PATH = "/auth/login";
    private static final String VALID_PASSWORD = "Workshop123!";
    private static final String WRONG_PASSWORD = "clave-incorrecta-ficticia";
    private static final String VALID_LOGIN_BODY =
            "{\"username\":\"student\",\"password\":\"" + VALID_PASSWORD + "\",\"client\":\"angular-workshop\"}";
    private static final long MAX_LIFETIME_DRIFT_SECONDS = 1;

    @Inject
    ControlledClock clock;

    @Inject
    TokenSettings settings;

    @BeforeEach
    void resetClock() {
        clock.reset();
    }

    @Test
    void logsInWithWorkshopUser() {
        given()
                .contentType("application/json")
                .body("{\"username\":\"student\",\"password\":\"Workshop123!\",\"client\":\"angular-workshop\"}")
                .when().post(LOGIN_PATH)
                .then()
                .statusCode(200)
                .body("user.username", is("student"))
                .body("token", notNullValue());
    }

    // Caracteriza REQ "Preserve the login HTTP contract" (spec auth-token) y docs/ENDPOINTS.md.
    @Test
    void keepsSuccessfulLoginResponseShape() {
        given()
                .contentType("application/json")
                .body("{\"username\":\"student\",\"password\":\"Workshop123!\",\"client\":\"angular-workshop\"}")
                .when().post(LOGIN_PATH)
                .then()
                .statusCode(200)
                .body("token", instanceOf(String.class))
                .body("expiresIn", is(3600))
                .body("user.keySet()", containsInAnyOrder("username", "displayName", "role"))
                .body("user.username", is("student"))
                .body("user.displayName", is("Workshop Student"))
                .body("user.role", is("STUDENT"));
    }

    // Caracteriza el rechazo de credenciales: no exitoso y sin token. No fija codigo ni mensaje.
    @Test
    void rejectsWrongPasswordWithoutToken() {
        assertLoginNotSuccessful("{\"username\":\"student\",\"password\":\"incorrecta\",\"client\":\"angular-workshop\"}");
    }

    @Test
    void rejectsUnknownUserWithoutToken() {
        assertLoginNotSuccessful("{\"username\":\"usuario-inexistente\",\"password\":\"Workshop123!\",\"client\":\"angular-workshop\"}");
    }

    // Caracteriza username/password ausentes o blank: no exitoso y sin token.
    @Test
    void rejectsMissingUsernameWithoutToken() {
        assertLoginNotSuccessful("{\"password\":\"Workshop123!\",\"client\":\"angular-workshop\"}");
    }

    @Test
    void rejectsBlankUsernameWithoutToken() {
        assertLoginNotSuccessful("{\"username\":\"   \",\"password\":\"Workshop123!\",\"client\":\"angular-workshop\"}");
    }

    @Test
    void rejectsMissingPasswordWithoutToken() {
        assertLoginNotSuccessful("{\"username\":\"student\",\"client\":\"angular-workshop\"}");
    }

    @Test
    void rejectsBlankPasswordWithoutToken() {
        assertLoginNotSuccessful("{\"username\":\"student\",\"password\":\"   \",\"client\":\"angular-workshop\"}");
    }

    @Test
    void rejectsEmptyBodyWithoutToken() {
        assertLoginNotSuccessful("");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"username\":\"student\",\"password\":\"Workshop123!\"}",
            "{\"username\":\"student\",\"password\":\"Workshop123!\",\"client\":\"   \"}",
            "{\"username\":\"student\",\"password\":\"Workshop123!\",\"client\":null}",
            "{\"username\":\"student\",\"password\":\"Workshop123!\",\"client\":12345}",
            "{\"username\":\"student\",\"password\":\"Workshop123!\",\"client\":[\"angular-workshop\"]}"
    })
    void rejectsMissingBlankOrNonStringClientWithoutToken(String body) {
        assertLoginNotSuccessful(body);
    }

    @Test
    void issuesTokenWithRequiredClaimsForValidClient() throws Exception {
        String token = loginAndExtractToken(VALID_LOGIN_BODY);

        JwtClaims claims = verify(token, Instant.now());

        assertEquals("student", claims.getSubject());
        assertEquals("angular-workshop", claims.getClaimValue("client"));
        assertTrue(claims.getExpirationTime().getValue() > claims.getIssuedAt().getValue());
    }

    @Test
    void tokenLifetimeMatchesAdvertisedExpiresIn() throws Exception {
        var response = given()
                .contentType("application/json")
                .body(VALID_LOGIN_BODY)
                .when().post(LOGIN_PATH)
                .then().statusCode(200)
                .extract().response();

        JwtClaims claims = verify(response.path("token"), Instant.now());
        long lifetime = claims.getExpirationTime().getValue() - claims.getIssuedAt().getValue();
        Number advertised = response.path("expiresIn");

        assertTrue(lifetime > 0);
        assertTrue(Math.abs(lifetime - advertised.longValue()) <= MAX_LIFETIME_DRIFT_SECONDS);
    }

    @Test
    void rejectsExpiredTokenWhenVerified() throws Exception {
        Instant issuedLongAgo = Instant.now().minusSeconds(7200);
        clock.setInstant(issuedLongAgo);
        String token = loginAndExtractToken(VALID_LOGIN_BODY);

        InvalidJwtException error = assertThrows(InvalidJwtException.class, () -> verify(token, Instant.now()));

        assertTrue(error.hasExpired());
    }

    @Test
    void keepsTokenPasswordAndSecretOutOfLogs() {
        List<String> entries = new ArrayList<>();
        Handler capture = captureInto(entries);
        Logger root = Logger.getLogger("");
        root.addHandler(capture);
        try {
            String token = loginAndExtractToken(VALID_LOGIN_BODY);
            assertLoginNotSuccessful("{\"username\":\"student\",\"password\":\"" + WRONG_PASSWORD + "\",\"client\":\"angular-workshop\"}");
            assertFalse(entries.stream().anyMatch(entry -> entry.contains(token)));
        } finally {
            root.removeHandler(capture);
        }

        assertFalse(entries.stream().anyMatch(entry -> entry.contains(VALID_PASSWORD)));
        assertFalse(entries.stream().anyMatch(entry -> entry.contains(WRONG_PASSWORD)));
        assertFalse(entries.stream().anyMatch(entry -> entry.contains(settings.secret())));
    }

    private String loginAndExtractToken(String body) {
        return given()
                .contentType("application/json")
                .body(body)
                .when().post(LOGIN_PATH)
                .then().statusCode(200)
                .extract().path("token");
    }

    private JwtClaims verify(String token, Instant evaluationTime) throws InvalidJwtException {
        return new JwtConsumerBuilder()
                .setVerificationKey(new HmacKey(settings.secret().getBytes(StandardCharsets.UTF_8)))
                .setJwsAlgorithmConstraints(new AlgorithmConstraints(ConstraintType.WHITELIST, "HS256"))
                .setRequireExpirationTime()
                .setRequireIssuedAt()
                .setRequireSubject()
                .setEvaluationTime(NumericDate.fromSeconds(evaluationTime.getEpochSecond()))
                .build()
                .processToClaims(token);
    }

    private static Handler captureInto(List<String> entries) {
        return new Handler() {
            private final SimpleFormatter formatter = new SimpleFormatter();

            @Override
            public void publish(LogRecord record) {
                entries.add(formatter.format(record));
            }

            @Override
            public void flush() {
            }

            @Override
            public void close() {
            }
        };
    }

    private void assertLoginNotSuccessful(String body) {
        given()
                .contentType("application/json")
                .body(body)
                .when().post(LOGIN_PATH)
                .then()
                .statusCode(greaterThanOrEqualTo(300))
                .body("token", nullValue());
    }
}

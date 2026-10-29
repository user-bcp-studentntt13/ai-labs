package com.bcp.workshop.auth;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
class TokenSettingsTest {
    private static final int MIN_HS256_KEY_BYTES = 32;

    @Inject
    TokenSettings settings;

    @Test
    void testProfileUsesIsolatedFakeSecret() {
        String secret = settings.secret();

        assertTrue(secret.startsWith("test-only-"));
        assertTrue(secret.getBytes(StandardCharsets.UTF_8).length >= MIN_HS256_KEY_BYTES);
    }
}

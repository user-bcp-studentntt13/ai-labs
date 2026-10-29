package com.bcp.workshop.auth;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;

import java.nio.charset.StandardCharsets;

@ApplicationScoped
public class TokenSecretValidator {
    private static final int MIN_HS256_KEY_BYTES = 32;

    @Inject
    TokenSettings settings;

    void validateOnStartup(@Observes StartupEvent event) {
        String secret = settings.secret();
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("AUTH_TOKEN_SECRET is required to start the auth service");
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < MIN_HS256_KEY_BYTES) {
            throw new IllegalStateException("AUTH_TOKEN_SECRET must be at least 32 bytes for HS256");
        }
    }
}

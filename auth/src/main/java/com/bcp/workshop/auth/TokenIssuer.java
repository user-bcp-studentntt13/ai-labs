package com.bcp.workshop.auth;

import io.smallrye.jwt.algorithm.SignatureAlgorithm;
import io.smallrye.jwt.build.Jwt;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.Clock;
import java.time.Instant;

@ApplicationScoped
public class TokenIssuer {
    static final long LIFETIME_SECONDS = 3600;
    private static final String CLIENT_CLAIM = "client";

    @Inject
    TokenSettings settings;

    @Inject
    Clock clock;

    public IssuedToken issue(String subject, String client) {
        Instant issuedAt = clock.instant();
        Instant expiresAt = issuedAt.plusSeconds(LIFETIME_SECONDS);
        String token = Jwt.claims()
                .subject(subject)
                .claim(CLIENT_CLAIM, client)
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .jws().algorithm(SignatureAlgorithm.HS256)
                .signWithSecret(settings.secret());
        return new IssuedToken(token, LIFETIME_SECONDS);
    }
}

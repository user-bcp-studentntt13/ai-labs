package com.bcp.workshop.auth;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;

class TokenSecretValidatorTest {

    @Test
    void failsStartupWhenSecretIsMissing() {
        TokenSecretValidator validator = validatorWithSecret(null);

        assertThrows(IllegalStateException.class, () -> validator.validateOnStartup(null));
    }

    @Test
    void failsStartupWhenSecretIsBlank() {
        TokenSecretValidator validator = validatorWithSecret("   ");

        assertThrows(IllegalStateException.class, () -> validator.validateOnStartup(null));
    }

    @Test
    void failsStartupWhenSecretIsShorterThanHs256Key() {
        TokenSecretValidator validator = validatorWithSecret("corto-para-hs256");

        assertThrows(IllegalStateException.class, () -> validator.validateOnStartup(null));
    }

    private static TokenSecretValidator validatorWithSecret(String secret) {
        TokenSecretValidator validator = new TokenSecretValidator();
        validator.settings = () -> secret;
        return validator;
    }
}

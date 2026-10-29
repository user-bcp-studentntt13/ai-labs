package com.bcp.workshop.auth;

import io.smallrye.config.ConfigMapping;

@ConfigMapping(prefix = "auth.token")
public interface TokenSettings {
    String secret();
}

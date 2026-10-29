package com.bcp.workshop.auth;

import jakarta.enterprise.inject.Produces;

import java.time.Clock;

public class ClockProducer {
    @Produces
    Clock clock() {
        return Clock.systemUTC();
    }
}

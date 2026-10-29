package com.bcp.workshop.auth;

import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

@Alternative
@Priority(1)
@ApplicationScoped
public class ControlledClock extends Clock {
    private Instant instant = Instant.now();

    public void setInstant(Instant instant) {
        this.instant = instant;
    }

    public void reset() {
        this.instant = Instant.now();
    }

    @Override
    public ZoneId getZone() {
        return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return this;
    }

    @Override
    public Instant instant() {
        return instant;
    }
}

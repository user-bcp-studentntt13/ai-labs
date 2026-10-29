package com.bcp.workshop.auth;

import org.junit.jupiter.api.Test;

import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ClockProducerTest {

    @Test
    void producesUtcSystemClock() {
        assertEquals(ZoneOffset.UTC, new ClockProducer().clock().getZone());
    }
}

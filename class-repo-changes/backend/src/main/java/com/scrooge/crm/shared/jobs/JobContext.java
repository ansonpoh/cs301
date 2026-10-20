package com.scrooge.crm.shared.jobs;

import java.time.Instant;

/** @param trigger what started the run: "schedule" or "manual" */
public record JobContext(Instant startedAt, String trigger) {
}

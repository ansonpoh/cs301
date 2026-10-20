package com.scrooge.crm.transactions;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TransactionReader {

    /** COMPLETED transactions only, oldest first. {@code from} and {@code to} may be {@code null}. */
    List<TransactionView> completed(UUID clientId, Instant from, Instant to);

    /** Any status; F6 uses it to check a disputed transaction. */
    Optional<TransactionView> find(String transactionId);

    /** The latest business date with imported data: F5's "as of" date. */
    Optional<LocalDate> latestDataDate();
}

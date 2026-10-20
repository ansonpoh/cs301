package com.scrooge.crm.transactions;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** @param id the core-banking transaction id */
public record TransactionView(
        String id,
        UUID clientId,
        UUID accountId,
        TransactionType type,
        BigDecimal amount,
        Instant occurredAt,
        TransactionStatus status) {
}

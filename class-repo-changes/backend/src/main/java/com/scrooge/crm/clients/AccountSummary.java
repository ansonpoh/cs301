package com.scrooge.crm.clients;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record AccountSummary(
        UUID id,
        UUID clientId,
        AccountType type,
        AccountStatus status,
        LocalDate openingDate,
        BigDecimal initialDeposit,
        String currency,
        String branchId,
        AccountSource source,
        UUID sourceRef) {
}

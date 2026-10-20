package com.scrooge.crm.clients;

import java.math.BigDecimal;
import java.util.UUID;

/** @param sourceRef the recommendation id when {@code source} is RECOMMENDATION, otherwise {@code null} */
public record OpenAccount(
        UUID clientId,
        AccountType type,
        BigDecimal initialDeposit,
        String branchId,
        AccountSource source,
        UUID sourceRef) {
}

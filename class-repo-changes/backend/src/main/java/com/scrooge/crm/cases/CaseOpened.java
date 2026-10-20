package com.scrooge.crm.cases;

import java.util.UUID;

/** @param transactionId the disputed transaction, or {@code null} */
public record CaseOpened(UUID caseId, UUID clientId, CaseCategory category, String transactionId) {
}

package com.scrooge.crm.recommendations;

import java.util.UUID;

/** @param accountId the account opened from the recommendation, or {@code null} */
public record RecommendationOutcomeRecorded(
        UUID clientId, UUID recommendationId, RecommendationOutcome outcome, UUID accountId) {
}

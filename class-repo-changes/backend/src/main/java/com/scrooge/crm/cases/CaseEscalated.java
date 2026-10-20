package com.scrooge.crm.cases;

import java.util.UUID;

public record CaseEscalated(UUID caseId, UUID clientId, UUID assigneeId) {
}

package com.scrooge.crm.cases;

import java.util.UUID;

public record CaseStatusChanged(UUID caseId, UUID clientId, CaseStatus from, CaseStatus to) {
}

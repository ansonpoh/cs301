package com.scrooge.crm.verification;

import java.util.UUID;

public record WealthCaseDecided(UUID wealthCaseId, UUID clientId, WealthOutcome outcome) {
}

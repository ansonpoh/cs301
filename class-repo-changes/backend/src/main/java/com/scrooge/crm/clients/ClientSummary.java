package com.scrooge.crm.clients;

import java.time.LocalDate;
import java.util.UUID;

public record ClientSummary(
        UUID id,
        UUID agentId,
        String firstName,
        String lastName,
        LocalDate dateOfBirth,
        IdentityStatus identityStatus,
        boolean recoConsent) {
}

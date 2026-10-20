package com.scrooge.crm.shared.audit;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * What happened, who did it and what it touched. The audit service sets the timestamp itself.
 *
 * @param actorId  the user, or {@code null} for scheduled jobs (shown as SYSTEM)
 * @param clientId the client concerned, or {@code null} (import runs, staff changes)
 * @param changes  Update only; Create, Read and Delete store just the Client ID
 * @param details  feature-specific fields, stored as JSONB
 */
public record AuditEntry(
        String eventType,
        Crud crud,
        UUID actorId,
        UUID clientId,
        String entityType,
        String entityId,
        List<FieldChange> changes,
        Map<String, Object> details) {

    public AuditEntry {
        changes = changes == null ? List.of() : List.copyOf(changes);
        details = details == null ? Map.of() : Map.copyOf(details);
    }
}

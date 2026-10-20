package com.scrooge.crm.clients;

import java.util.Set;
import java.util.UUID;

public record ClientUpdated(UUID clientId, Set<String> changedFields) {
}

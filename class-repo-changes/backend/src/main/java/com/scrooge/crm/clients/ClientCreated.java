package com.scrooge.crm.clients;

import java.util.UUID;

public record ClientCreated(UUID clientId, UUID agentId) {
}

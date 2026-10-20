package com.scrooge.crm.clients;

import java.util.UUID;

public record AccountStatusChanged(UUID accountId, UUID clientId, AccountStatus from, AccountStatus to) {
}

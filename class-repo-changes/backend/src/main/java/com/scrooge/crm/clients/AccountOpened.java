package com.scrooge.crm.clients;

import java.util.UUID;

public record AccountOpened(UUID accountId, UUID clientId, AccountType type, AccountSource source) {
}

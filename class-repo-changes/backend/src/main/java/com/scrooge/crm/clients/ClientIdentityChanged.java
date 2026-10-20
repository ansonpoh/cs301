package com.scrooge.crm.clients;

import java.util.UUID;

public record ClientIdentityChanged(UUID clientId, IdentityStatus status) {
}

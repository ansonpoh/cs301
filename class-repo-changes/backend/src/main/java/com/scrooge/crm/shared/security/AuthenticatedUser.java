package com.scrooge.crm.shared.security;

import java.util.UUID;

public record AuthenticatedUser(UUID id, Role role, boolean active) {
}

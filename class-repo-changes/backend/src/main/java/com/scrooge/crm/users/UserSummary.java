package com.scrooge.crm.users;

import java.util.UUID;

import com.scrooge.crm.shared.security.Role;

public record UserSummary(UUID id, String firstName, String lastName, String email, Role role, boolean active) {
}

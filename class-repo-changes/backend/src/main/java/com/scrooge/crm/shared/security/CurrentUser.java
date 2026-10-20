package com.scrooge.crm.shared.security;

import java.util.UUID;

/** The signed-in user for the current request, built from the JWT. */
public interface CurrentUser {

    UUID id();

    Role role();

    default boolean isAdmin() {
        return role() == Role.ADMIN;
    }
}

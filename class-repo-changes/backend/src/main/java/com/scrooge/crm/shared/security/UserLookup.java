package com.scrooge.crm.shared.security;

import java.util.Optional;

/**
 * Implemented by the users module, so that security doesn't depend on it.
 * The security filter rejects users that are missing or inactive.
 */
public interface UserLookup {

    Optional<AuthenticatedUser> findByCognitoSub(String cognitoSub);
}

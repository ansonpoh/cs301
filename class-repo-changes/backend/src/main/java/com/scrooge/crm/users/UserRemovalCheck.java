package com.scrooge.crm.users;

import java.util.List;
import java.util.UUID;

/**
 * Implemented by modules that assign work to users (clients, cases). Disabling or deleting a user is
 * refused while any blocker remains. Lets users ask without depending on those modules.
 */
public interface UserRemovalCheck {

    /** Reasons the user can't be removed yet, e.g. "owns 12 clients"; empty if none. */
    List<String> blockers(UUID userId);
}

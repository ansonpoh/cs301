package com.scrooge.crm.users;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserDirectory {

    Optional<UserSummary> find(UUID userId);

    /** Checked before assigning a client or a case. */
    boolean isActiveAgent(UUID userId);

    /** Recipients of F6 escalation emails. */
    List<UserSummary> admins();
}

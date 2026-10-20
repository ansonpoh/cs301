package com.scrooge.crm.clients;

import java.util.UUID;

public interface ActivationService {

    /** Runs the identity check and every {@link ActivationCheck}; activates PENDING accounts if all pass. */
    ActivationResult evaluate(UUID clientId);
}

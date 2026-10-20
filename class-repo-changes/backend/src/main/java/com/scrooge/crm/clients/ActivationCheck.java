package com.scrooge.crm.clients;

import java.util.UUID;

/**
 * A rule that must pass before a client's pending accounts activate. Implemented by verification
 * (verified wealth case for high-value accounts), so clients doesn't depend on verification.
 */
public interface ActivationCheck {

    CheckResult check(UUID clientId);
}

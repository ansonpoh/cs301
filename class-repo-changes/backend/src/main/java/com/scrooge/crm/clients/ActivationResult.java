package com.scrooge.crm.clients;

import java.util.List;
import java.util.UUID;

/** @param waitingOn why accounts are still pending, e.g. "identity PENDING"; empty if none */
public record ActivationResult(UUID clientId, List<UUID> activatedAccountIds, List<String> waitingOn) {
}

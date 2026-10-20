package com.scrooge.crm.clients;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Read access to clients for other modules. Erased clients are never returned. */
public interface ClientDirectory {

    Optional<ClientSummary> find(UUID clientId);

    List<UUID> idsForAgent(UUID agentId);

    /** @throws ClientNotFoundException if the client doesn't exist or is erased */
    UUID agentOf(UUID clientId);

    boolean hasRecoConsent(UUID clientId);
}

package com.scrooge.crm.clients;

import java.util.UUID;

/** The ownership check every client-scoped endpoint calls. */
public interface ClientAccess {

    /**
     * Admins always pass; agents pass only for their own clients. Otherwise audits ACCESS_DENIED
     * (standalone, so it survives the rollback) and throws, which becomes a 403.
     */
    void assertCanAccess(UUID clientId);
}

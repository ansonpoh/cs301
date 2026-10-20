package com.scrooge.crm.shared.audit;

import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

public interface AuditService {

    /**
     * Creates, reads, updates and deletes: commits or rolls back together with the change.
     * Audited reads must not run in a {@code readOnly} transaction, because Postgres rejects the insert.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    void record(AuditEntry entry);

    /**
     * Access denials and failed imports: written in its own transaction, so it survives the caller's
     * rollback. Holds a second connection while it runs, so keep it for rare events.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void recordStandalone(AuditEntry entry);
}

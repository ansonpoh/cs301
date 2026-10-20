package com.scrooge.crm.shared.erasure;

import java.util.UUID;

/** Implemented by every module that holds data about a client. */
public interface ErasureParticipant {

    /** Scrub this module's own tables, in the caller's transaction. */
    void eraseClient(UUID clientId);

    /** Clean-up a database transaction can't cover, such as S3 objects. Runs after commit and is retried. */
    default void afterErasure(UUID clientId) {
    }
}

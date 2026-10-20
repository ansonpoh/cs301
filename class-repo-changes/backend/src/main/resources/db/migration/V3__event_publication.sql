-- Spring Modulith event publication registry: our outbox (docs/core-tables-and-contracts.md, part B3).
-- Copied from spring-modulith-events-jdbc 2.1.1 (schemas/v2/schema-postgresql.sql). Flyway owns the
-- schema, so Modulith's own schema initialisation stays off.
CREATE TABLE event_publication
(
    id                     uuid                     NOT NULL,
    listener_id            text                     NOT NULL,
    event_type             text                     NOT NULL,
    serialized_event       text                     NOT NULL,
    publication_date       timestamp with time zone NOT NULL,
    completion_date        timestamp with time zone,
    status                 text,
    completion_attempts    int,
    last_resubmission_date timestamp with time zone,
    PRIMARY KEY (id)
);
CREATE INDEX event_publication_serialized_event_hash_idx ON event_publication USING hash (serialized_event);
CREATE INDEX event_publication_by_completion_date_idx ON event_publication (completion_date);

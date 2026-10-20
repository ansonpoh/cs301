package com.scrooge.crm.transactions;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record TransactionsImported(UUID importRunId, Set<UUID> clientIds, Instant latestOccurredAt) {
}

package com.scrooge.crm.clients;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AccountService {

    List<AccountSummary> listForClient(UUID clientId);

    Optional<AccountSummary> find(UUID accountId);

    /** Opens a PENDING account. F4's "accept and open account" passes source RECOMMENDATION. */
    AccountSummary open(OpenAccount command);
}

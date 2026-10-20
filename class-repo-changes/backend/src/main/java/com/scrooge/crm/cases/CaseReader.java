package com.scrooge.crm.cases;

import java.util.UUID;

public interface CaseReader {

    /** Cases that aren't RESOLVED. */
    OpenCases openForClient(UUID clientId);
}

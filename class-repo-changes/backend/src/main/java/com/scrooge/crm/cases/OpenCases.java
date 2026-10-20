package com.scrooge.crm.cases;

import java.util.List;
import java.util.Set;
import java.util.UUID;

public record OpenCases(int count, Set<CaseCategory> categories, List<UUID> ids) {
}

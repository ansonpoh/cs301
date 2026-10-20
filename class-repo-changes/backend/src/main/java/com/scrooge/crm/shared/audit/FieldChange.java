package com.scrooge.crm.shared.audit;

/** One changed attribute; stored encrypted with the client's key (decision D13). */
public record FieldChange(String attribute, String before, String after) {
}

package com.scrooge.crm.shared.jobs;

/**
 * A scheduled job (F3 import, F5 risk scoring, F6 SLA check). Jobs run only in the worker:
 * {@code @Scheduled} locally, an EventBridge Scheduler message through SQS on AWS.
 */
public interface Job {

    /** Stable name, e.g. "transactions-import". */
    String name();

    void run(JobContext context);
}

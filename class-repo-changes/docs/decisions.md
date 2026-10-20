# Design decisions

Meant to live in the repo as `docs/decisions.md`. Every design or implementation choice gets a short entry here: what we chose, what we rejected, and why. When a decision changes, don't delete the old entry. Mark it **Replaced by Dn** and add a new one, so the reasoning trail stays visible for the report.

**Status:** *Decided* means agreed by the team. *Proposed* means drafted and waiting for a team meeting.

| # | Decision | Status |
|---|---|---|
| D1 | Spring Boot for the backend | Decided |
| D2 | Java 25 | Decided |
| D3 | Modular monolith, deployed as three services | Decided |
| D4 | F4 stays in Java and calls Bedrock | Decided |
| D5 | PostgreSQL (Aurora on AWS) with Flyway migrations | Decided |
| D6 | Develop locally first; deploy to AWS in short sessions | Decided |
| D7 | LocalStack pinned to 4.14.0 | Decided |
| D8 | UUIDv7 for IDs | Proposed |
| D9 | Spring Modulith for module boundaries and events | Proposed |
| D10 | Transaction server hosted on AWS as its own service | Proposed |
| D11 | AWS CDK for infrastructure, GitHub Actions for CI/CD | Decided |
| D12 | "Delete" erases or closes; nothing is hard-deleted | Proposed |
| D13 | Crypto-shredding for PII in the audit log | Proposed |

---

## D1. Spring Boot for the backend

**Chose:** Spring Boot 4.1 (Java), with Spring Security, Spring Data JPA, Flyway and springdoc-openapi.
**Rejected:** NestJS (TypeScript/Node.js).

**Why:**
- The brief allows any language. It lists Java, Spring Boot and NodeJS as common choices (*CS301 Project.pdf*, "Points to note" #2).
- Spring Boot is the norm for enterprise banking systems, which makes it easy to defend in a design review for a bank CRM.
- It covers what the brief needs without extra libraries: Spring Security for the OAuth2/JWT checks (Zero Trust), Flyway for versioned schema changes, JPA with optimistic locking, and OpenAPI generated from the code.
- NestJS's main advantage was reusing the demo's TypeScript business rules as they are. Starting a fresh repo removed most of that saving.

**Cost:** the demo's rules (about 1,500 lines plus tests) are rewritten in Java instead of moved across.

## D2. Java 25

**Chose:** Java 25 (LTS).
**Rejected:** Java 21 (LTS).

**Why:**
- Both are long-term-support releases. 25 is the current one, and Spring Boot 4 supports it.
- The app runs in a container on Fargate, so AWS doesn't restrict the version.
- It brings faster startup and smaller object headers.

**Cost:** everyone installs JDK 25 and sets `JAVA_HOME` to it.

## D3. Modular monolith, deployed as three services

**Chose:** one Spring Boot codebase split into one module per feature (F1–F6), with boundaries enforced in the build. It's deployed as three separately scaled services:
- **CRM API:** user-facing, scales on request load.
- **Worker:** the same code, running scheduled jobs and queue consumers, scales on queue depth.
- **Transaction server:** stands in for the external core-banking system.

**Rejected:** one microservice per feature.

**Why:**
- **Cost:** each microservice is its own Fargate task running all the time. Six services, at two tasks each across two availability zones, would use up the USD 400 budget much faster.
- **Consistency:** a change and its audit row are saved in one database transaction. Some actions cross features: accepting an F4 recommendation opens an F2 account and runs the activation check. Across separate services that needs distributed transactions or sagas.
- **Team size:** every service needs its own auth checks, Dockerfile, CI job and deployment. That's six times the plumbing for eight people.
- **The proposal:** the architecture deck already shows one ECS application with F1–F6 modules.
- **The brief:** microservices are optional (NFR 11c). The rubric penalises unexplained choices and adding services "just to look comprehensive".

**What still gets split, and why:** the worker, so a slow import never slows the API and each scales on its own signal. The transaction server, because it represents an external system.

**Risk:** Appendix 1 ("Cloud Native First") mentions microservices, so check the final rubric or ask the TA. If microservices are explicitly marked, split out at most one more feature (F3 is the natural candidate), not all six. D9 keeps that possible without a rewrite.

## D4. F4 stays in Java and calls Bedrock

**Chose:** the recommendations module calls Amazon Bedrock (Converse API) through the AWS SDK for Java, with a rules-based fallback.
**Rejected:** a separate Python service for the AI feature.

**Why:**
- F4 doesn't train a model. Bedrock is an HTTPS API, and the Java SDK calls it as easily as Python does, so Python adds no AI capability here.
- A Python service would add a second app to build and deploy, another Fargate task, service-to-service authentication, and either an extra network hop or a second component reading client data.
- Permission checks, eligibility rules, the fallback and the audit trail have to live in the backend anyway.

**Revisit if:** we add real machine learning beyond Bedrock (for example, a propensity model trained on the transaction data). In that case, the Python part should be a small stateless service with no database access.

## D5. PostgreSQL (Aurora on AWS) with Flyway migrations

**Chose:** PostgreSQL 16 locally, Aurora PostgreSQL on AWS, with schema changes only through Flyway migration files. Hibernate checks the schema at startup (`ddl-auto=validate`) and never changes it.
**Rejected:** DynamoDB; letting Hibernate generate the schema.

**Why:**
- The data is relational (clients, accounts, transactions, cases), and the important guarantees are relational: unique email and phone, "this account belongs to this client", and a change and its audit row committed together.
- Aurora gives managed failover and point-in-time restore, which the resilience requirements need.
- Migration files are reviewable in pull requests, run the same way on every laptop and on AWS, and are a record of how the schema changed.

## D6. Develop locally first; deploy to AWS in short sessions

**Chose:** everyone develops against Docker Compose (Postgres and LocalStack) and fakes for Cognito, Textract and Bedrock. AWS runs in two layers:
- A cheap base stack that can stay up: Cognito, S3, SQS, KMS, ECR, EventBridge, SES.
- A compute stack (VPC, load balancer, Aurora, Fargate, NAT) that's deployed for an integration session and destroyed afterwards. The dev profile costs about USD 0.10–0.20 an hour.

**Rejected:** deploying the full architecture at the start and building against it.

**Why:** one shared team account and USD 400 total, including Bedrock. Always-on compute and NAT would use most of the budget before the features exist. Scripted deploy and destroy also proves the infrastructure-as-code really works.

## D7. LocalStack pinned to 4.14.0

**Chose:** the image `localstack/localstack:4.14.0`.
**Rejected:** `latest`.

**Why:** releases from 2026 onwards need a paid auth token and exit on start without one (exit code 55, seen on 2026.10.0). 4.14.0 runs free. It passed smoke tests for S3, SQS, SNS, SES and EventBridge, which are all the services we use locally.

**Cost:** no newer LocalStack features. Real AWS behaviour is checked in the D6 sessions anyway.

## D8. UUIDv7 for IDs (Proposed)

**Chose:** UUIDv7 primary keys, stored as Postgres `uuid` and generated by Hibernate. Transaction IDs stay as text, because they come from the core-banking file.
**Rejected:** prefixed ULIDs (`CL-01J…`), auto-increment integers, random UUIDv4.

**Why:**
- **Over auto-increment:** IDs can't be guessed or counted (an attacker can't walk `/clients/1`, `/clients/2`), and Hibernate assigns them when the entity is persisted, before the insert, so related rows can reference them in the same transaction.
- **Over UUIDv4:** v7 is time-ordered, so new rows land at the end of the index instead of in random places. Inserts stay cheap and indexes stay compact.
- **Over prefixed ULIDs:**
  - The native `uuid` type is 16 bytes, against about 30 for the text form, in every index and foreign key.
  - Java and Hibernate support it with no custom generator.
  - The team already knows UUIDs.
  - The brief only requires IDs that are unique and system-generated.
- **Readability**, the prefix's real advantage, is covered elsewhere:
  - URLs name the entity (`/clients/{id}`).
  - Audit rows store the entity type next to the ID.
  - If people ever need to read IDs aloud, a short display reference can be added separately.

**Note:** Postgres 16 can't generate v7 itself, so the application always supplies the ID.

## D9. Spring Modulith for module boundaries and events (Proposed)

**Chose:** Spring Modulith 2.x.
- A test fails the build if a module uses another module's internals or the modules form a dependency cycle.
- Its event publication registry stores events in the same transaction as the change, which makes it our outbox.

**Rejected:** relying on package conventions alone; hand-writing an outbox table and dispatcher.

**Why:**
- With eight people, conventions that aren't checked drift. A failing build is the cheapest reviewer.
- The registry gives reliable after-commit events (no lost or phantom events) without writing and testing our own outbox.
- Enforced boundaries are what make D3's "any module could become its own service" claim credible, and Modulith can generate module diagrams for the report.

Details are in [core-tables-and-contracts.md](core-tables-and-contracts.md), part B.

## D10. Transaction server hosted on AWS as its own service (Proposed)

**Chose:** the F3 core-banking simulator runs as a separate service, with its own stack on AWS.
**Rejected:** running it outside AWS, as the proposal deck shows; or building it into the CRM.

**Why:**
- The course requires everything to run on AWS.
- Keeping it separate preserves the brief's premise that core banking is an external system, so connection failures and corrupted files can be demonstrated for real.

## D11. AWS CDK for infrastructure, GitHub Actions for CI/CD

**Chose:** AWS CDK in `infra/`, and GitHub Actions for build, test and deploy (via OIDC, so no long-lived AWS keys).
**Rejected:** Terraform; CloudFormation written by hand; CodePipeline.

**Why:**
- CDK is AWS-native and handles AWS-only details (such as ECS scheduled tasks and Cognito triggers) directly. It also lets one codebase define a cheap dev profile and a full profile.
- GitHub Actions already runs our CI where the code lives, so CI and CD stay in one place at no extra AWS cost.

## D12. "Delete" erases or closes; nothing is hard-deleted (Proposed)

**Chose:** keep the brief's endpoints (`DELETE /api/clients/{id}`, `DELETE /api/accounts/{id}`, delete user) but change what they do:
- **Client:** erased. The PII is set to NULL, the accounts are closed, the audit data key is deleted (D13), and the row stays as an anonymous shell.
- **Account:** status becomes `CLOSED`.
- **User:** `deleted_at` is set and the Cognito user is deleted, so the email can be used again. Disabling a user stays a separate operation, as in the brief.

**Rejected:** a literal `DELETE FROM` the database, which is what the brief's use case text describes.

**Why:**
- Transactions, cases and audit rows reference these rows. A hard delete either fails on the foreign keys, or cascades and destroys records a bank must keep.
- The brief requires deletions to be audited. The audit rows reference the client, so the client row must survive for the audit trail to make sense.
- Erasing the PII meets the privacy goal of deletion (GDPR right to erasure) while keeping the records that aren't personal.

**Risk:** markers may read "deletes the client profile from the database" literally. The demo and report should show the result explicitly: the client vanishes from every screen and API, and their PII is gone from the live database, S3 and the audit log. Copies in backups expire with the backup retention period (proposed 7 days), and a restore re-applies erasures from an erasure log.

## D13. Crypto-shredding for PII in the audit log (Proposed)

**Chose:** each client gets its own data key. Audit before/after values and `details` are encrypted with it (envelope encryption with KMS on AWS). Erasing the client deletes the key.
**Rejected:** storing plain values; storing masked values; deleting or editing audit rows on erasure.

**Why:** two brief requirements pull against each other.
- The audit must record the real old and new values.
- The audit must be tamper-resistant, so rows can't be edited or deleted.
- A client's PII must be removable.

Plain values break erasure. Masked values break the before/after requirement. Editing rows breaks tamper resistance. Deleting the key makes the values unreadable without touching any row, so all three hold.

**Cost:** an extra key lookup per audit write and read, and keys must be cached briefly. Losing the key store means losing readable history, so it's backed up with the database. Restoring a pre-erasure backup would bring a deleted key back, which is why erasure is complete only once backups expire, and a restore replays the erasure log (D12).

**Scope:** only rows about a client are encrypted with a client key. Rows with no client (import runs, staff user changes) hold no client PII and are stored as they are.

---

## Template for new entries

```
## Dn. <decision>

**Chose:** …
**Rejected:** …
**Why:** …
**Cost / risk:** …
```

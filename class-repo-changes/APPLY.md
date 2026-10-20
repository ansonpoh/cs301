# Applying these files to the class repo

For the Claude session on Anson's device, working in `C:\Users\anson\Desktop\project-2026-27t1-g3-t4`.
Do NOT commit, branch or push in the class repo. Leave every change uncommitted.

1. Copy everything in this folder except `APPLY.md` into the repo root, keeping paths:
   - `docs/decisions.md`, `docs/core-tables-and-contracts.md`
   - `backend/src/main/resources/db/migration/V2__core_tables.sql`, `V3__event_publication.sql`
   - `backend/src/main/java/com/scrooge/crm/**` and `backend/src/test/java/com/scrooge/crm/**`
   If a file already exists (most likely `shared/package-info.java`), merge: keep the existing Javadoc
   and add the `@ApplicationModule(type = ApplicationModule.Type.OPEN)` annotation and its import.
2. `backend/pom.xml`:
   - In `<dependencyManagement><dependencies>`, import the BOM:
     `org.springframework.modulith:spring-modulith-bom:2.1.1`, `<type>pom</type>`, `<scope>import</scope>`.
   - Add dependencies (no versions): `spring-modulith-starter-core`, `spring-modulith-starter-jdbc`,
     and `spring-modulith-starter-test` with `<scope>test</scope>`.
3. `CrmApplication.java`: add `@EnableAsync` (`org.springframework.scheduling.annotation.EnableAsync`).
   `@ApplicationModuleListener` runs asynchronously.
4. `README.md`: in the Architecture section, add one line linking `docs/decisions.md` (why each choice
   was made) and `docs/core-tables-and-contracts.md` (tables, interfaces and events).
5. With Docker running and `JAVA_HOME` on JDK 25, run `./mvnw -B verify` in `backend/`. It should run
   Flyway V1–V3 against a Testcontainers Postgres, `ModularityTests` and `SgCalendarTests`.
   If something fails, report the exact error. Don't delete or weaken a test to make it pass.
6. Report `git status --short` and the test summary.

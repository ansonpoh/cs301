/**
 * Cross-cutting code every module may use: audit, security, erasure, time and jobs.
 * Open module, so its sub-packages are visible to all other modules.
 */
@ApplicationModule(type = ApplicationModule.Type.OPEN)
package com.scrooge.crm.shared;

import org.springframework.modulith.ApplicationModule;

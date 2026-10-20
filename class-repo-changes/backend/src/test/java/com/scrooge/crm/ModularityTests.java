package com.scrooge.crm;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

/** Fails the build if a module uses another module's internals or the modules form a cycle. */
class ModularityTests {

    @Test
    void modulesAreValid() {
        ApplicationModules.of(CrmApplication.class).verify();
    }
}

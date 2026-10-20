package com.scrooge.crm.shared.time;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

class SgCalendarTests {

    // Friday 2026-10-16 23:30 in Singapore is still Friday 15:30 in UTC.
    private static final Instant FRIDAY_LATE_SG = Instant.parse("2026-10-16T15:30:00Z");

    private final SgCalendar calendar = new SgCalendar(Clock.fixed(FRIDAY_LATE_SG, ZoneOffset.UTC));

    @Test
    void todayUsesSingaporeDate() {
        SgCalendar earlyMorningSg = new SgCalendar(Clock.fixed(Instant.parse("2026-10-16T17:00:00Z"), ZoneOffset.UTC));
        assertThat(earlyMorningSg.today()).isEqualTo(LocalDate.of(2026, 10, 17));
        assertThat(calendar.today()).isEqualTo(LocalDate.of(2026, 10, 16));
    }

    @Test
    void businessDaysSkipWeekends() {
        Instant nextTuesday = Instant.parse("2026-10-20T02:00:00Z");
        assertThat(calendar.businessDaysBetween(FRIDAY_LATE_SG, nextTuesday)).isEqualTo(2);
        assertThat(calendar.businessDaysBetween(FRIDAY_LATE_SG, FRIDAY_LATE_SG)).isZero();
    }

    @Test
    void addBusinessDaysSkipsWeekends() {
        Instant result = calendar.addBusinessDays(FRIDAY_LATE_SG, 1);
        assertThat(result.atZone(SgCalendar.ZONE).toLocalDate()).isEqualTo(LocalDate.of(2026, 10, 19));
        assertThat(calendar.addBusinessDays(FRIDAY_LATE_SG, 0)).isEqualTo(FRIDAY_LATE_SG);
    }
}

package com.scrooge.crm.shared.time;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import org.springframework.stereotype.Component;

/**
 * "Today" and business days in Singapore time. Times are stored in UTC, so anything that depends on
 * the calendar date goes through here. Business days are Monday to Friday; public holidays are not
 * handled yet.
 */
@Component
public final class SgCalendar {

    public static final ZoneId ZONE = ZoneId.of("Asia/Singapore");

    private final Clock clock;

    public SgCalendar(Clock clock) {
        this.clock = clock;
    }

    public Instant now() {
        return clock.instant();
    }

    public LocalDate today() {
        return LocalDate.now(clock.withZone(ZONE));
    }

    /** Business days after {@code from}'s date, up to and including {@code to}'s date. */
    public int businessDaysBetween(Instant from, Instant to) {
        LocalDate start = from.atZone(ZONE).toLocalDate();
        LocalDate end = to.atZone(ZONE).toLocalDate();
        int days = 0;
        for (LocalDate d = start.plusDays(1); !d.isAfter(end); d = d.plusDays(1)) {
            if (isBusinessDay(d)) {
                days++;
            }
        }
        return days;
    }

    /** Same Singapore time of day, {@code days} business days later. */
    public Instant addBusinessDays(Instant from, int days) {
        if (days < 0) {
            throw new IllegalArgumentException("days must not be negative");
        }
        var dateTime = from.atZone(ZONE);
        int added = 0;
        while (added < days) {
            dateTime = dateTime.plusDays(1);
            if (isBusinessDay(dateTime.toLocalDate())) {
                added++;
            }
        }
        return dateTime.toInstant();
    }

    private static boolean isBusinessDay(LocalDate date) {
        return date.getDayOfWeek() != DayOfWeek.SATURDAY && date.getDayOfWeek() != DayOfWeek.SUNDAY;
    }
}

/**
 * Temporal API Type Declarations
 *
 * The Temporal API shipped in all major browsers by mid-2025.
 * These declarations provide TypeScript support for the native API.
 *
 * @see https://tc39.es/proposal-temporal/docs/
 */

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Temporal {
  interface Instant {
    epochMilliseconds: number;
    epochNanoseconds: bigint;
    toZonedDateTimeISO(timeZone: string): ZonedDateTime;
    subtract(duration: DurationLike): Instant;
    until(other: Instant): Duration;
    add(duration: DurationLike): Instant;
    toString(): string;
  }

  interface ZonedDateTime {
    epochMilliseconds: number;
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    millisecond: number;
    microsecond: number;
    nanosecond: number;
    timeZoneId: string;
    toInstant(): Instant;
    toLocaleString(locale?: string, options?: Intl.DateTimeFormatOptions): string;
    toString(): string;
    with(fields: Partial<ZonedDateTimeFields>): ZonedDateTime;
    add(duration: DurationLike): ZonedDateTime;
  }

  interface ZonedDateTimeFields {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    millisecond: number;
    microsecond: number;
    nanosecond: number;
  }

  interface PlainDateTime {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    toZonedDateTime(timeZone: string): ZonedDateTime;
    toString(): string;
  }

  interface PlainDate {
    year: number;
    month: number;
    day: number;
    add(duration: DurationLike): PlainDate;
    toString(): string;
  }

  interface Duration {
    years: number;
    months: number;
    weeks: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    milliseconds: number;
    microseconds: number;
    nanoseconds: number;
    total(options: { unit: string }): number;
  }

  interface DurationLike {
    years?: number;
    months?: number;
    weeks?: number;
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
    milliseconds?: number;
    microseconds?: number;
    nanoseconds?: number;
  }

  // Static constructors
  const Now: {
    instant(): Instant;
    timeZoneId(): string;
  };

  const Instant: {
    fromEpochMilliseconds(epochMilliseconds: number): Instant;
    fromEpochNanoseconds(epochNanoseconds: bigint): Instant;
    from(item: string | Instant): Instant;
    compare(one: Instant, two: Instant): -1 | 0 | 1;
  };

  const PlainDateTime: {
    from(
      item:
        | string
        | PlainDateTime
        | {
            year: number;
            month: number;
            day: number;
            hour?: number;
            minute?: number;
            second?: number;
          }
    ): PlainDateTime;
  };

  const PlainDate: {
    from(item: string | PlainDate | { year: number; month: number; day: number }): PlainDate;
  };

  const Duration: {
    from(item: string | DurationLike): Duration;
  };
}

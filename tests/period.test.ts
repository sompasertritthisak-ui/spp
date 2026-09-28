import { describe, expect, it } from "vitest";
import { MAX_YEARS, checkPeriod, termEnd } from "../src/components/billboards/period";

const open = { status: "available", availableFrom: null };
const today = "2027-01-15";

describe("yearly billboard terms", () => {
  it("a term ends the day before its anniversary", () => {
    expect(termEnd("2027-02-01", 1)).toBe("2028-01-31");
    expect(termEnd("2027-02-01", 3)).toBe("2030-01-31");
    expect(termEnd("2028-02-29", 1)).toBe("2029-02-28"); // leap-day start
    expect(termEnd("2027-03-01", 1)).toBe("2028-02-29"); // ends on a leap day
  });
  it("derives the end date and the inclusive day count", () => {
    const c = checkPeriod("2027-02-01", 1, today, 1, open, []);
    expect(c.errors).toEqual({});
    expect(c.end).toBe("2028-01-31");
    expect(c.days).toBe(365);
  });
  it("enforces the site minimum, the ceiling and the calendar", () => {
    expect(checkPeriod("2027-02-01", 1, today, 2, open, []).errors.years).toMatch(/minimum term here is 2 years/);
    expect(checkPeriod("2027-02-01", MAX_YEARS + 1, today, 1, open, []).errors.years).toMatch(/agreed directly/);
    expect(checkPeriod("2026-12-31", 1, today, 1, open, []).errors.start).toMatch(/past/);
    expect(checkPeriod("", 1, today, 1, open, []).errors.start).toMatch(/start/);
    expect(checkPeriod("2031-06-01", 2, today, 1, open, []).errors.start).toMatch(/within the next 5 years/);
  });
  it("reports clashes without blocking", () => {
    const c = checkPeriod("2027-02-01", 1, today, 1, open, [{ startsOn: "2027-06-01", endsOn: "2027-08-31", kind: "booked" }]);
    expect(c.errors).toEqual({});
    expect(c.clashes).toHaveLength(1);
    expect(c.clashes[0]).toMatch(/^Booked/);
    const held = checkPeriod("2027-02-01", 1, today, 1, { status: "reserved", availableFrom: "2027-06-01" }, []);
    expect(held.clashes[0]).toMatch(/Currently reserved/);
  });
});

import { describe, expect, it } from "vitest";
import { addDays, eachDay, monthDays, shiftMonth } from "@/lib/dates";

describe("tarih yardımcıları", () => {
  it("ayın günlerini verir, artık yılı bilir", () => {
    expect(monthDays("2028-02").days).toHaveLength(29);
    expect(monthDays("2026-10").days.at(-1)).toBe("2026-10-31");
  });
  it("geçersiz ayda bugünün ayına döner", () => {
    expect(monthDays("bozuk", new Date("2026-10-05T12:00:00Z")).month).toBe("2026-10");
  });
  it("ay ve gün kaydırır", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(eachDay("2026-10-30", "2026-11-01")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
  });
});

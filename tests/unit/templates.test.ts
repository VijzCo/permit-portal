import { describe, expect, it } from "vitest";
import {
  describeDaysLeft,
  digestSubject,
  employeeUrl,
  escapeHtml,
  groupByUrgency,
  renderDigest,
  type DigestItem,
} from "@/lib/email/templates";

function item(overrides: Partial<DigestItem>): DigestItem {
  return {
    authId: "a1",
    employeeId: "e1",
    employeeName: "Li Wei",
    departmentName: "Sewing",
    designationName: "Technician",
    type: "WORK_PERMIT",
    referenceNumber: "WP-1",
    expiryDate: "2026-10-10",
    daysLeft: 10,
    threshold: "14",
    ...overrides,
  };
}

const ITEMS: DigestItem[] = [
  item({ authId: "a1", employeeName: "Ann", daysLeft: 20, expiryDate: "2026-10-20", threshold: "30" }),
  item({ authId: "a2", employeeName: "Ben", daysLeft: -3, expiryDate: "2026-09-27", threshold: "OVERDUE_2026-40" }),
  item({ authId: "a3", employeeName: "Cal", daysLeft: 3, expiryDate: "2026-10-03", threshold: "7" }),
  item({ authId: "a4", employeeName: "Dee", daysLeft: 10, expiryDate: "2026-10-10", threshold: "14" }),
];

describe("digestSubject", () => {
  it("matches the spec format", () => {
    expect(digestSubject("RW Design", ITEMS, "2026-09-30")).toBe("[Permit/Visa] 3 expiring, 1 expired — RW Design — 2026-09-30");
  });
  it("omits zero counts", () => {
    expect(digestSubject("QA", [ITEMS[0] as DigestItem], "2026-09-30")).toBe("[Permit/Visa] 1 expiring — QA — 2026-09-30");
    expect(digestSubject("QA", [ITEMS[1] as DigestItem], "2026-09-30")).toBe("[Permit/Visa] 1 expired — QA — 2026-09-30");
  });
});

describe("groupByUrgency", () => {
  it("orders groups Expired → 0–7 → 8–14 → 15–30 and drops empty ones", () => {
    const groups = groupByUrgency(ITEMS);
    expect(groups.map((g) => g.bucket)).toEqual(["EXPIRED", "D0_7", "D8_14", "D15_30"]);
    expect(groups.map((g) => g.items.map((i) => i.employeeName))).toEqual([["Ben"], ["Cal"], ["Dee"], ["Ann"]]);
    expect(groupByUrgency([ITEMS[0] as DigestItem]).map((g) => g.bucket)).toEqual(["D15_30"]);
  });
  it("sorts by expiry within a group", () => {
    const groups = groupByUrgency([
      item({ employeeName: "Z", daysLeft: 5, expiryDate: "2026-10-05" }),
      item({ employeeName: "Y", daysLeft: 1, expiryDate: "2026-10-01" }),
    ]);
    expect(groups[0]?.items.map((i) => i.employeeName)).toEqual(["Y", "Z"]);
  });
});

describe("renderDigest", () => {
  const out = renderDigest({ companyName: "RW Design", today: "2026-09-30", baseUrl: "https://permits.example.com/", items: ITEMS });

  it("links every employee page", () => {
    expect(out.html).toContain('href="https://permits.example.com/employees/e1"');
    expect(out.text).toContain("https://permits.example.com/employees/e1");
  });
  it("renders groups in urgency order in both parts", () => {
    const h = out.html;
    expect(h.indexOf("Expired (1)")).toBeLessThan(h.indexOf("0–7 days"));
    expect(h.indexOf("0–7 days")).toBeLessThan(h.indexOf("8–14 days"));
    expect(h.indexOf("8–14 days")).toBeLessThan(h.indexOf("15–30 days"));
    expect(out.text.indexOf("== Expired")).toBeLessThan(out.text.indexOf("== Expiring in 0–7"));
  });
  it("escapes user content", () => {
    const x = renderDigest({ companyName: "<b>Co</b>", today: "2026-09-30", baseUrl: "https://x", items: [item({ employeeName: '<script>alert("x")</script>' })] });
    expect(x.html).not.toContain("<script>");
    expect(x.html).toContain("&lt;script&gt;");
    expect(x.html).not.toContain("<b>Co</b>");
  });
  it("has a plain-text fallback with no HTML", () => {
    expect(out.text).not.toMatch(/<[a-z]/i);
    expect(out.text).toContain("Work Permit WP-1");
  });
});

describe("helpers", () => {
  it("describes days left", () => {
    expect(describeDaysLeft(-5)).toBe("Expired 5 days ago");
    expect(describeDaysLeft(-1)).toBe("Expired yesterday");
    expect(describeDaysLeft(0)).toBe("Expires today");
    expect(describeDaysLeft(1)).toBe("1 day left");
    expect(describeDaysLeft(12)).toBe("12 days left");
  });
  it("escapes html and builds urls", () => {
    expect(escapeHtml(`a&b<"'>`)).toBe("a&amp;b&lt;&quot;&#39;&gt;");
    expect(employeeUrl("https://x.com//", "e 1")).toBe("https://x.com/employees/e%201");
  });
});

import { describe, expect, test } from "vitest";
import fixtures from "./rubric.fixtures.json";
import { compute, emptyInputs, fmt, type Inputs, type Settings } from "@/lib/venture-framework/rubric";

type Fixture = (typeof fixtures)[number];

function toInputs(f: Fixture["input"]): [Inputs, Settings] {
  const inputs: Inputs = {
    ...emptyInputs(),
    vertical: f.vertical ?? "",
    gates: f.gates as Inputs["gates"],
    scores: f.scores,
    fundSize: f.fundSize,
    checkSize: f.checkSize,
    entryValuation: f.entryValuation,
    forwardRevenue: f.forwardRevenue,
    treasuryCash: f.treasuryCash,
    monthlyBurn: f.monthlyBurn,
    dilution: f.dilution,
    scenarios: f.scenarios,
  };
  return [inputs, f.settings];
}

function close(actual: unknown, expected: unknown, path: string) {
  if (typeof expected === "number" && typeof actual === "number") {
    expect(actual, path).toBeCloseTo(expected, 9);
  } else {
    expect(actual, path).toEqual(expected);
  }
}

describe("matches the workbook", () => {
  test.each(fixtures.map((f, i) => [i, f] as const))("case %d", (_, f) => {
    const [inputs, settings] = toInputs(f.input);
    const r = compute(inputs, settings);
    const e = f.expected;
    close(r.filter, e.filter, "D19");
    close(r.weightedScore, e.weightedScore, "E88");
    close(r.verdict, e.verdict, "E7");
    close(r.weakestCategory, e.weakestCategory, "E10");
    close(r.ownershipAtEntry, e.ownershipAtEntry, "E92");
    close(r.ownershipAtExit, e.ownershipAtExit, "E93");
    close(r.exitValueToReturnFund, e.exitValueToReturnFund, "E94");
    close(r.requiredMultiple, e.requiredMultiple, "E95");
    close(r.entryPriceToSales, e.entryPriceToSales, "E96");
    close(r.runwayMonths, e.runwayMonths, "E97");
    close(r.totalProbability, e.totalProbability, "B107");
    close(r.probabilityOk ? "OK" : "Must total 100%", e.probabilityCheck, "C107");
    close(r.expectedMultiple, e.expectedMultiple, "E108");
    close(r.meetsTarget, e.meetsTarget, "E9");
    close(r.probabilityReturnsFund, e.probabilityReturnsFund, "E109");
    r.categories.forEach((c, i) => {
      const x = e.categories[i]!;
      close(c.weight, x.weight, `B${78 + i}`);
      close(c.scored, x.scored, `C${78 + i}`);
      close(c.avg, x.avg, `D${78 + i}`);
      close(c.pct, x.pct, `E${78 + i}`);
      close(c.points, x.points, `F${78 + i}`);
    });
    r.scenarios.forEach((s, i) => {
      const x = e.scenarios[i]!;
      close(s.multiple, x.multiple, `D${102 + i}`);
      close(s.weighted, x.weighted, `E${102 + i}`);
      close(s.returnsFund, x.returnsFund, `F${102 + i}`);
    });
  });
});

describe("number formats", () => {
  test("money: $#,##0;($#,##0);\"-\"", () => {
    expect(fmt.money(1234567.6)).toBe("$1,234,568");
    expect(fmt.money(-2500)).toBe("($2,500)");
    expect(fmt.money(0)).toBe("-");
    expect(fmt.money(null)).toBe("");
  });
  test("percent and multiples", () => {
    expect(fmt.pct1(0.4567)).toBe("45.7%");
    expect(fmt.pct1(0)).toBe("-");
    expect(fmt.pct2(0.0125)).toBe("1.25%");
    expect(fmt.mult1(12.34)).toBe("12.3x");
    expect(fmt.mult2(0.5)).toBe("0.50x");
    expect(fmt.num1(61.25)).toBe("61.3");
  });
});

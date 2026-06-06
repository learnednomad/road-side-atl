import { describe, it, expect } from "vitest";
import { generateCSV } from "@/lib/csv";

describe("generateCSV", () => {
  it("quotes values containing commas, quotes, or newlines", () => {
    const csv = generateCSV(
      ["name", "note"],
      [["Doe, John", 'say "hi"'], ["multi\nline", "plain"]]
    );
    expect(csv).toBe(
      'name,note\n"Doe, John","say ""hi"""\n"multi\nline",plain'
    );
  });

  it("neutralizes formula injection in string fields starting with = + - @", () => {
    const csv = generateCSV(
      ["field"],
      [
        ["=cmd|'/c calc'!A1"],
        ["+1234567890"],
        ["-2+3"],
        ["@SUM(A1:A2)"],
      ]
    );
    const lines = csv.split("\n");
    // each risky value is prefixed with a single quote so spreadsheets treat it as text
    expect(lines[1]).toBe("'=cmd|'/c calc'!A1");
    expect(lines[2]).toBe("'+1234567890");
    expect(lines[3]).toBe("'-2+3");
    expect(lines[4]).toBe("'@SUM(A1:A2)");
  });

  it("does NOT mangle legitimate negative numbers", () => {
    const csv = generateCSV(["amount"], [[-500], [42]]);
    expect(csv).toBe("amount\n-500\n42");
  });
});

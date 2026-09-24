import { describe, expect, it } from "vitest";
import { toCents } from "./ui";

describe("toCents", () => {
  it.each([
    ["35", 3500],
    ["35.5", 3550],
    ["35.05", 3505],
    ["0.1", 10],
    ["", 0],
    [" 12 ", 1200],
  ])("parses %j", (input, cents) => {
    expect(toCents(input)).toBe(cents);
  });

  it.each(["35.555", "-5", "abc", "1,000", "$5"])("rejects %j", (input) => {
    expect(toCents(input)).toBeNull();
  });
});

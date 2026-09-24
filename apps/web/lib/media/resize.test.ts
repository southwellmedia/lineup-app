import { describe, expect, it } from "vitest";
import { fitWithin } from "./resize";

describe("fitWithin", () => {
  it("shrinks the longest edge and keeps the aspect ratio", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1500, height: 2000 });
  });
  it("never enlarges small photos", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

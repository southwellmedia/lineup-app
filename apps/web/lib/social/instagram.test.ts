import { describe, expect, it } from "vitest";
import { instagramHandle } from "./instagram";

describe("instagramHandle", () => {
  it("accepts a handle, an @handle or a profile link", () => {
    expect(instagramHandle.parse("southside.cuts")).toBe("southside.cuts");
    expect(instagramHandle.parse(" @southside.cuts ")).toBe("southside.cuts");
    expect(instagramHandle.parse("https://www.instagram.com/southside.cuts/?hl=en")).toBe(
      "southside.cuts",
    );
  });
  it("treats blank as none and rejects junk", () => {
    expect(instagramHandle.parse("")).toBeNull();
    expect(instagramHandle.safeParse("not a handle!").success).toBe(false);
  });
});

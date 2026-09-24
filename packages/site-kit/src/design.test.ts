import { describe, expect, it } from "vitest";
import { designInput, emphasis, mediaPaths, mergeDesign, resolveDesign, TEMPLATES } from "./design";

const SHOP = "00000000-0000-4000-8000-000000000001";
const photo = { path: `${SHOP}/hero.jpg`, alt: "Chair" };

describe("resolveDesign", () => {
  it("gives every template section, in default order, when nothing is stored", () => {
    const d = resolveDesign("contact-sheet", null);
    expect(d.sections.map((s) => s.type)).toEqual(TEMPLATES["contact-sheet"].sections);
    expect(d.sections.find((s) => s.type === "reviews")?.enabled).toBe(false);
    expect(d.sections.find((s) => s.type === "hero")?.props).toEqual({
      eyebrow: "",
      lede: "",
      image: null,
    });
  });

  it("keeps the stored order and settings, and appends new sections", () => {
    const stored = {
      "contact-sheet": {
        sections: [
          { type: "visit", enabled: true, props: {} },
          { type: "hero", enabled: false, props: { lede: "Sharp.", image: photo } },
        ],
      },
    };
    const d = resolveDesign("contact-sheet", stored);
    expect(d.sections.slice(0, 2).map((s) => [s.type, s.enabled])).toEqual([
      ["visit", true],
      ["hero", false],
    ]);
    expect(d.sections[1]?.props).toMatchObject({ lede: "Sharp.", image: photo });
    expect(d.sections).toHaveLength(TEMPLATES["contact-sheet"].sections.length);
  });

  it("drops duplicates, unknown sections and invalid props instead of failing", () => {
    const stored = {
      classic: {
        sections: [
          { type: "hero", props: { lede: 42 } },
          { type: "hero", props: { lede: "second" } },
          { type: "gallery", props: {} }, // not a classic section
          { type: "nope" },
        ],
      },
    };
    const d = resolveDesign("classic", stored);
    expect(d.sections.map((s) => s.type)).toEqual(TEMPLATES.classic.sections);
    expect(d.sections[0]?.props).toMatchObject({ lede: "" });
  });

  it("rejects media outside the bucket layout", () => {
    const d = resolveDesign("contact-sheet", {
      "contact-sheet": {
        sections: [{ type: "hero", props: { image: { path: "../../etc/passwd" } } }],
      },
    });
    expect(d.sections[0]?.props).toMatchObject({ image: null });
  });
});

describe("saving", () => {
  it("validates input and merges one template without touching another", () => {
    const input = designInput.parse({
      template: "contact-sheet",
      sections: [{ type: "hero", enabled: true, props: { lede: "Hi", image: photo } }],
    });
    const merged = mergeDesign({ classic: { sections: [] } }, input);
    expect(Object.keys(merged).sort()).toEqual(["classic", "contact-sheet"]);
    expect(mediaPaths(input.sections)).toEqual([photo.path]);
  });

  it("rejects bad props", () => {
    expect(
      designInput.safeParse({
        template: "contact-sheet",
        sections: [{ type: "reviews", enabled: true, props: { rating: "11" } }],
      }).success,
    ).toBe(false);
  });
});

describe("emphasis", () => {
  it("splits *italic* words without HTML", () => {
    expect(emphasis("Trained in *São Paulo*. <b>")).toEqual([
      { text: "Trained in ", em: false },
      { text: "São Paulo", em: true },
      { text: ". <b>", em: false },
    ]);
  });
});

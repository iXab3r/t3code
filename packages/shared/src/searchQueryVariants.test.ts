import { describe, expect, it } from "vite-plus/test";

import { getSearchQueryVariants } from "./searchQueryVariants.ts";

describe("getSearchQueryVariants", () => {
  it.each([
    ["ьщвуд", "model"],
    ["ЬЩВУД", "MODEL"],
    [".ьщвуд-12", ".model-12"],
    ["  ыек ", "  str "],
    ["ёхжэбю", "`[;',."],
  ])("preserves the original query and recovers %s as %s", (query, recovered) => {
    expect(getSearchQueryVariants(query)).toEqual([
      { text: query, source: "original" },
      { text: recovered, source: "keyboard-layout" },
    ]);
  });

  it.each(["", "model", "mщdel", "🙂", "αф"])(
    "keeps literal, mixed-script, and unsupported input %s intact",
    (query) => {
      expect(getSearchQueryVariants(query)).toEqual([{ text: query, source: "original" }]);
    },
  );

  it("accepts other layout maps and deduplicates complete readings", () => {
    const first = new Map([["λ", "l"]]);
    const second = new Map([["λ", "l"]]);
    const unchanged = new Map([["λ", "λ"]]);

    expect(getSearchQueryVariants("λλ", [first, second, unchanged])).toEqual([
      { text: "λλ", source: "original" },
      { text: "ll", source: "keyboard-layout" },
    ]);
    expect(getSearchQueryVariants("λф", [first])).toEqual([{ text: "λф", source: "original" }]);
  });
});

import { describe, expect, it } from "vite-plus/test";

import { createSearchKeyboardLayout, getSearchQueryVariants } from "./searchQueryVariants.ts";

describe("getSearchQueryVariants", () => {
  it.each([
    ["λλ", "ll"],
    ["ΛΛ", "LL"],
    [".λλ-12", ".ll-12"],
    ["  λ ", "  l "],
    ["λ🙂", "l🙂"],
  ])("preserves the original query and recovers %s as %s", (query, recovered) => {
    const layout = new Map([
      ["λ", "l"],
      ["Λ", "L"],
    ]);
    expect(getSearchQueryVariants(query, [layout])).toEqual([
      { text: query, source: "original" },
      { text: recovered, source: "keyboard-layout" },
    ]);
  });

  it.each(["", "model", "mщdel", "🙂", "αф", "ьщвуд"])(
    "keeps input %s literal without a supplied layout",
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
    expect(getSearchQueryVariants("y", [new Map([["y", "z"]])])).toEqual([
      { text: "y", source: "original" },
      { text: "z", source: "keyboard-layout" },
    ]);
  });
});

describe("createSearchKeyboardLayout", () => {
  it.each([
    ["ьщвуд", ["KeyM", "KeyO", "KeyD", "KeyE", "KeyL"], "model"],
    ["μοδελ", ["KeyM", "KeyO", "KeyD", "KeyE", "KeyL"], "model"],
    ["צםגקך", ["KeyM", "KeyO", "KeyD", "KeyE", "KeyL"], "model"],
    ["zy", ["KeyY", "KeyZ"], "yz"],
    ["і", ["KeyS"], "s"],
    ["İ", ["KeyI"], "I"],
    ["λ", ["Semicolon"], ";"],
  ] as const)("learns %s from physical keys", (query, codes, recovered) => {
    const layout = createSearchKeyboardLayout();
    Array.from(query).forEach((key, index) => layout.recordKey({ key, code: codes[index]! }));
    expect(layout.getQueryVariants(query)).toEqual([
      { text: query, source: "original" },
      { text: recovered, source: "keyboard-layout" },
    ]);
    expect(layout.getQueryVariants(query.toUpperCase())).toEqual([
      { text: query.toUpperCase(), source: "original" },
      {
        text: query.toUpperCase() === query ? recovered : recovered.toUpperCase(),
        source: "keyboard-layout",
      },
    ]);
  });

  it("retains learned mappings across switches without guessing unknown letters", () => {
    const layout = createSearchKeyboardLayout();
    layout.recordKey({ code: "KeyY", key: "z" });
    layout.recordKey({ code: "KeyZ", key: "z" });
    layout.recordKey({ code: "KeyA", key: "α" });
    expect(layout.getQueryVariants("zα")).toEqual([
      { text: "zα", source: "original" },
      { text: "ya", source: "keyboard-layout" },
    ]);
    expect(layout.getQueryVariants("ьщвуд")).toEqual([{ text: "ьщвуд", source: "original" }]);
    layout.recordKey({ code: "KeyF", key: "ф" });
    expect(layout.getQueryVariants("ф")).toEqual([
      { text: "ф", source: "original" },
      { text: "f", source: "keyboard-layout" },
    ]);
    expect(layout.getQueryVariants("αβ")).toEqual([{ text: "αβ", source: "original" }]);
    expect(createSearchKeyboardLayout().getQueryVariants("α")).toEqual([
      { text: "α", source: "original" },
    ]);
  });

  it.each([
    { isComposing: true },
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { code: "Unidentified" },
    { key: "Dead" },
    { key: "αβ" },
  ])("ignores unusable or modified key events %j", (overrides) => {
    const layout = createSearchKeyboardLayout();
    layout.recordKey({ code: "KeyA", key: "α", ...overrides });
    expect(layout.getQueryVariants("α")).toEqual([{ text: "α", source: "original" }]);
  });
});

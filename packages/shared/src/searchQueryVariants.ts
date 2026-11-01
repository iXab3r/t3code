const US_SYMBOL_KEYS = new Map([
  ["Backquote", "`~"],
  ["Minus", "-_"],
  ["Equal", "=+"],
  ["BracketLeft", "[{"],
  ["BracketRight", "]}"],
  ["Backslash", "\\|"],
  ["Semicolon", ";:"],
  ["Quote", "'\""],
  ["Comma", ",<"],
  ["Period", ".>"],
  ["Slash", "/?"],
  ["Digit0", "0)"],
  ["Digit1", "1!"],
  ["Digit2", "2@"],
  ["Digit3", "3#"],
  ["Digit4", "4$"],
  ["Digit5", "5%"],
  ["Digit6", "6^"],
  ["Digit7", "7&"],
  ["Digit8", "8*"],
  ["Digit9", "9("],
]);

type KeyboardLayoutKey = {
  readonly code: string;
  readonly key: string;
  readonly isComposing?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  readonly shiftKey?: boolean;
};

type SearchQueryVariant = {
  readonly text: string;
  readonly source: "original" | "keyboard-layout";
};

export function getSearchQueryVariants(
  rawQuery: string,
  layouts: ReadonlyArray<ReadonlyMap<string, string>> = [],
) {
  const variants: SearchQueryVariant[] = [{ text: rawQuery, source: "original" }];
  const seen = new Set([rawQuery]);
  for (const layout of layouts) {
    let text = "";
    let supported = true;
    for (const character of rawQuery) {
      const replacement = layout.get(character);
      if (replacement !== undefined) {
        text += replacement;
      } else if (/\p{L}/u.test(character)) {
        supported = false;
        break;
      } else {
        text += character;
      }
    }
    if (supported && !seen.has(text)) {
      seen.add(text);
      variants.push({ text, source: "keyboard-layout" });
    }
  }
  return variants;
}

export function createSearchKeyboardLayout() {
  const learned = new Map(
    Array.from("abcdefghijklmnopqrstuvwxyz").flatMap((letter) => [
      [letter, letter] as const,
      [letter.toUpperCase(), letter.toUpperCase()] as const,
    ]),
  );
  const layouts = [learned];

  return {
    recordKey(event: KeyboardLayoutKey) {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!/^[\p{L}\p{N}\p{P}\p{S}]$/u.test(event.key)) return;
      const letterCode = /^Key([A-Z])$/.exec(event.code)?.[1];
      const isLetter = /^\p{L}$/u.test(event.key);
      const ascii = letterCode
        ? event.shiftKey && !isLetter
          ? letterCode
          : letterCode.toLowerCase()
        : US_SYMBOL_KEYS.get(event.code)?.[event.shiftKey ? 1 : 0];
      if (!ascii || event.key.toLowerCase() === ascii) return;

      if (letterCode && isLetter) {
        const lower = event.key.toLowerCase();
        const upper = event.key.toUpperCase();
        learned.set(
          event.key,
          upper !== lower && event.key === upper ? ascii.toUpperCase() : ascii,
        );
        if (Array.from(lower).length === 1) learned.set(lower, ascii);
        if (upper !== lower && Array.from(upper).length === 1)
          learned.set(upper, ascii.toUpperCase());
      } else {
        learned.set(event.key, ascii);
      }
    },
    getQueryVariants(query: string) {
      return getSearchQueryVariants(query, layouts);
    },
  };
}

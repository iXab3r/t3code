const US_KEYS = "`qwertyuiop[]asdfghjkl;'zxcvbnm,.";
const RUSSIAN_TO_US = new Map(
  Array.from("ёйцукенгшщзхъфывапролджэячсмитьбю").flatMap((character, index) => {
    const replacement = US_KEYS[index]!;
    return [
      [character, replacement] as const,
      [character.toUpperCase(), replacement.toUpperCase()] as const,
    ];
  }),
);
const DEFAULT_LAYOUTS = [RUSSIAN_TO_US];
const US_PUNCTUATION_KEYS = new Map([
  ["Backquote", "`"],
  ["Minus", "-"],
  ["Equal", "="],
  ["BracketLeft", "["],
  ["BracketRight", "]"],
  ["Backslash", "\\"],
  ["Semicolon", ";"],
  ["Quote", "'"],
  ["Comma", ","],
  ["Period", "."],
  ["Slash", "/"],
]);

type KeyboardLayoutKey = {
  readonly code: string;
  readonly key: string;
  readonly isComposing?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
};

type SearchQueryVariant = {
  readonly text: string;
  readonly source: "original" | "keyboard-layout";
};

export function getSearchQueryVariants(
  rawQuery: string,
  layouts: ReadonlyArray<ReadonlyMap<string, string>> = DEFAULT_LAYOUTS,
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
      if (!/^\p{L}$/u.test(event.key)) return;
      const ascii = /^Key[A-Z]$/.test(event.code)
        ? event.code.slice(3).toLowerCase()
        : US_PUNCTUATION_KEYS.get(event.code);
      if (!ascii || event.key.toLowerCase() === ascii) return;

      const lower = event.key.toLowerCase();
      const upper = event.key.toUpperCase();
      learned.set(event.key, upper !== lower && event.key === upper ? ascii.toUpperCase() : ascii);
      if (Array.from(lower).length === 1) learned.set(lower, ascii);
      if (upper !== lower && Array.from(upper).length === 1)
        learned.set(upper, ascii.toUpperCase());
    },
    getQueryVariants(query: string) {
      const variants = getSearchQueryVariants(query, layouts);
      return variants.length > 1 ? variants : getSearchQueryVariants(query);
    },
  };
}

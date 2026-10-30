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

type SearchQueryVariant = {
  readonly text: string;
  readonly source: "original" | "keyboard-layout";
};

export function getSearchQueryVariants(
  rawQuery: string,
  layouts: ReadonlyArray<ReadonlyMap<string, string>> = DEFAULT_LAYOUTS,
) {
  const variants: SearchQueryVariant[] = [{ text: rawQuery, source: "original" }];
  // Latin letters can be intentional parts of mixed-script names.
  if (/[a-z]/i.test(rawQuery)) return variants;

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

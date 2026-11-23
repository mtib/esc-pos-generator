import { DEFAULT_SETTINGS, Preset } from "./preset";

/**
 * The starting content. Do not change this string casually: react-use-storage-state overwrites the
 * saved value whenever its default changes, which would wipe what users have typed.
 */
export const DEFAULT_CONTENT = "# Heading\n## Subheading\nSome **text**\n- Iters\n1. Enums\n- [ ] Checkboxes\n- [x] Checkedboxes";

/**
 * Tea label for 58 mm paper (384 px): the tea name large and centred in small caps, then water
 * temperature and steep time side by side, each filling half of the width.
 * Inline styles survive the sanitiser; edit the three values to make a label for another tea.
 * For names longer than about 6 letters lower the 104px font size.
 * Shareable as https://esc.pos.mtib.dev/#<encodePreset(TEA_LABEL)>.
 */
export const TEA_LABEL: Preset = {
    ...DEFAULT_SETTINGS,
    padBottomPx: 30,
    content: [
        '<div style="text-align: center; font-size: 104px; font-weight: 900; font-variant: small-caps; line-height: 1; padding: 10px 0 12px; overflow-wrap: anywhere;">Sencha</div>',
        '<div style="display: flex; border-top: 4px solid black; border-bottom: 4px solid black;">',
        '<div style="flex: 1; text-align: center; padding: 8px 0;"><div style="font-size: 54px; font-weight: 900; line-height: 1.1;">75 °C</div><div style="font-size: 20px; font-variant: small-caps;">water</div></div>',
        '<div style="width: 4px; background: black;"></div>',
        '<div style="flex: 1; text-align: center; padding: 8px 0;"><div style="font-size: 54px; font-weight: 900; line-height: 1.1;">2 min</div><div style="font-size: 20px; font-variant: small-caps;">steep</div></div>',
        '</div>',
    ].join("\n"),
};

export const EXAMPLES: { name: string, preset: Preset }[] = [
    { name: "Checklist", preset: { ...DEFAULT_SETTINGS, content: DEFAULT_CONTENT } },
    { name: "Tea label", preset: TEA_LABEL },
];

/** Dots per millimetre of the usual 203 dpi thermal print head. */
export const DOTS_PER_MM = 8;

export const pxToMm = (px: number): number => Math.round(px / DOTS_PER_MM);

/** Common paper widths and the printable dots of a 203 dpi head on them. */
export const PAPER_PRESETS = [
    { label: "58 mm", widthPx: 384 },
    { label: "80 mm", widthPx: 576 },
] as const;

/** Turns the first line of the receipt text into a file name stem, "receipt" if nothing usable is left. */
export const slugify = (text: string, maxLength = 40): string => {
    const slug = text
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, maxLength)
        .replace(/-+$/, "");
    return slug === "" ? "receipt" : slug;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

export const downloadFileName = (firstLine: string, date: Date): string =>
    `${slugify(firstLine)}-${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}.bin`;

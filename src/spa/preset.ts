/**
 * URL hash presets: the hash is the base64url encoding (padding optional) of a UTF-8 JSON object.
 * All keys are optional, unknown keys are ignored, numbers are clamped to the ranges the UI allows.
 *
 *     https://esc.pos.mtib.dev/#<base64url({"content": "# Hi", "widthPx": 384, ...})>
 */

export type Settings = {
    widthPx: number,
    padLeftPx: number,
    padRightPx: number,
    padBottomPx: number,
    fontSizePx: number,
    lineHeight: number,
};

/**
 * `dither` and `offsetPx` describe the printer and the content, not the layout, so they live outside `Settings`
 * (loading an example must not reset them):
 *   - dither: Atkinson dithering of greys and pictures; off gives a hard black and white cut, crisper for plain text
 *   - offsetPx: shifts the content right (positive) or left (negative) by narrowing the opposite padding, to even out
 *     a printer whose paper margins differ: dots = (right margin - left margin in mm) * 8, measured per printer
 */
export type Preset = Partial<Settings> & { content?: string, dither?: boolean, offsetPx?: number };

type Range = { min: number, max: number, step: number };

export const OFFSET_RANGE: Range = { min: -64, max: 64, step: 1 };

/** Ranges shared by the sliders, the width field and the hash decoder. */
export const RANGES: { [K in keyof Settings]: Range } = {
    widthPx: { min: 8, max: 2048, step: 1 },
    padLeftPx: { min: 0, max: 30, step: 1 },
    padRightPx: { min: 0, max: 30, step: 1 },
    padBottomPx: { min: 0, max: 80, step: 1 },
    fontSizePx: { min: 6, max: 50, step: 1 },
    lineHeight: { min: 0.5, max: 3, step: 0.1 },
};

export const DEFAULT_SETTINGS: Settings = {
    widthPx: 384,
    padLeftPx: 0,
    padRightPx: 0,
    padBottomPx: 25,
    fontSizePx: 16,
    lineHeight: 1.2,
};

/** Clamps to the range and snaps to its step; returns undefined for anything that is not a finite number. */
export const clampSetting = (key: keyof Settings, value: unknown): number | undefined => clampToRange(RANGES[key], value);

export const clampToRange = (range: Range, value: unknown): number | undefined => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return undefined;
    }
    const { min, max, step } = range;
    const snapped = Math.round(value / step) * step;
    // round away floating point noise from the step multiplication (0.1 * 12 = 1.2000000000000002)
    const clean = Math.round(snapped * 1000) / 1000;
    return Math.min(max, Math.max(min, clean));
};

const toBase64Url = (bytes: Uint8Array): string => {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (text: string): Uint8Array => {
    const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

export const encodePreset = (preset: Preset): string =>
    toBase64Url(new TextEncoder().encode(JSON.stringify(preset)));

/** Decodes a hash (with or without the leading "#"); returns null for anything malformed or empty. */
export const decodePreset = (hash: string): Preset | null => {
    const text = hash.replace(/^#/, "").trim();
    if (text === "") {
        return null;
    }
    let parsed: unknown;
    try {
        const json = new TextDecoder("utf-8", { fatal: true }).decode(fromBase64Url(text));
        parsed = JSON.parse(json);
    } catch {
        return null;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return null;
    }
    const raw = parsed as Record<string, unknown>;
    const preset: Preset = {};
    if (typeof raw.content === "string") {
        preset.content = raw.content;
    }
    if (typeof raw.dither === "boolean") {
        preset.dither = raw.dither;
    }
    const offset = clampToRange(OFFSET_RANGE, raw.offsetPx);
    if (offset !== undefined) {
        preset.offsetPx = offset;
    }
    for (const key of Object.keys(RANGES) as (keyof Settings)[]) {
        const value = clampSetting(key, raw[key]);
        if (value !== undefined) {
            preset[key] = value;
        }
    }
    return Object.keys(preset).length > 0 ? preset : null;
};

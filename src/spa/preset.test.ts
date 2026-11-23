import { describe, expect, test } from "@jest/globals";
import { clampSetting, decodePreset, DEFAULT_SETTINGS, encodePreset, Preset } from "./preset";
import { TEA_LABEL } from "./examples";

describe("preset dither and offset", () => {
    test("round trips dither and offset", () => {
        expect(decodePreset(encodePreset({ content: "x", dither: false, offsetPx: 32 }))).toEqual({ content: "x", dither: false, offsetPx: 32 });
        expect(decodePreset(encodePreset({ dither: true, offsetPx: -16 }))).toEqual({ dither: true, offsetPx: -16 });
    });

    test("clamps the offset and ignores values of the wrong type", () => {
        expect(decodePreset(encodePreset({ offsetPx: 500 }))?.offsetPx).toBe(64);
        expect(decodePreset(encodePreset({ offsetPx: -500 }))?.offsetPx).toBe(-64);
        const bad = btoa(JSON.stringify({ content: "x", dither: "no", offsetPx: "3" })).replace(/=+$/, "");
        expect(decodePreset(bad)).toEqual({ content: "x" });
    });
});

describe("preset hash codec", () => {
    test("round trips content and settings", () => {
        const preset: Preset = { ...DEFAULT_SETTINGS, content: "# Hello\n- [x] done" };
        expect(decodePreset(encodePreset(preset))).toEqual(preset);
    });

    test("round trips the tea label example", () => {
        expect(decodePreset(encodePreset(TEA_LABEL))).toEqual(TEA_LABEL);
    });

    test("handles unicode outside latin-1", () => {
        const content = "Grüner Tee 75 °C, 抹茶 🍵 and “quotes”";
        expect(decodePreset(encodePreset({ content }))).toEqual({ content });
    });

    test("produces url safe output without padding", () => {
        const hash = encodePreset({ content: "??>>~~ÿÿ" });
        expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    test("accepts a leading # and explicit padding", () => {
        const hash = encodePreset({ content: "a" });
        const padded = hash + "=".repeat((4 - hash.length % 4) % 4);
        expect(decodePreset("#" + padded)).toEqual({ content: "a" });
    });

    test("ignores unknown keys and wrong types", () => {
        const hash = encodePreset({ content: 5, widthPx: "384", evil: "<script>", fontSizePx: 20 } as unknown as Preset);
        expect(decodePreset(hash)).toEqual({ fontSizePx: 20 });
    });

    test("clamps and snaps numbers", () => {
        const hash = encodePreset({ widthPx: 99999, padLeftPx: -4, lineHeight: 1.234, fontSizePx: 12.6 });
        expect(decodePreset(hash)).toEqual({ widthPx: 2048, padLeftPx: 0, lineHeight: 1.2, fontSizePx: 13 });
        expect(clampSetting("lineHeight", 1.2)).toBe(1.2);
        expect(clampSetting("widthPx", NaN)).toBeUndefined();
    });

    test.each([
        ["", "empty"],
        ["#", "only the hash sign"],
        ["!!!not base64!!!", "invalid characters"],
        [encodePreset("just a string" as unknown as Preset), "a JSON string"],
        [encodePreset([1, 2] as unknown as Preset), "a JSON array"],
        [encodePreset({}), "an empty object"],
        [Buffer.from("{not json").toString("base64url"), "broken JSON"],
        [Buffer.from([0xff, 0xfe, 0x7b]).toString("base64url"), "invalid UTF-8"],
    ])("returns null for %s (%s)", (hash) => {
        expect(decodePreset(hash)).toBeNull();
    });
});

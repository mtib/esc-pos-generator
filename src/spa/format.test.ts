import { describe, expect, test } from "@jest/globals";
import { downloadFileName, pxToMm, slugify } from "./format";
import { Cancelled, friendlyError, RenderError } from "./errors";

describe("format helpers", () => {
    test("slugify keeps letters and digits", () => {
        expect(slugify("  Grüner Tee: 75 °C! ")).toBe("gruner-tee-75-c");
        expect(slugify("***")).toBe("receipt");
        expect(slugify("a".repeat(60))).toHaveLength(40);
    });

    test("download file name has the local date", () => {
        expect(downloadFileName("Shopping list", new Date(2026, 10, 3))).toBe("shopping-list-2026-11-03.bin");
    });

    test("pixels to millimetres at 203 dpi", () => {
        expect(pxToMm(384)).toBe(48);
        expect(pxToMm(612)).toBe(77);
    });
});

describe("friendlyError", () => {
    const domError = (name: string, message: string) => Object.assign(new Error(message), { name });

    test("explains common WebUSB failures", () => {
        expect(friendlyError(domError("SecurityError", "Access denied."))).toMatch(/denied/);
        expect(friendlyError(domError("SecurityError", "Must be handling a user gesture to show a permission request."))).toMatch(/click/);
        expect(friendlyError(domError("NetworkError", "Unable to claim interface."))).toMatch(/another program/);
        expect(friendlyError(domError("NotFoundError", "The device was disconnected."))).toMatch(/disconnected/);
    });

    test("explains images that cannot be read", () => {
        expect(friendlyError(new RenderError({ type: "error" }))).toMatch(/image/);
        expect(friendlyError(new RenderError(new Error("The canvas has been tainted")))).toMatch(/image/);
        expect(friendlyError(new RenderError(new Error("boom")))).toMatch(/boom/);
    });

    test("falls back to the message", () => {
        expect(friendlyError(new Error("plain"))).toBe("plain");
        expect(new Cancelled()).toBeInstanceOf(Cancelled);
    });
});

/** Thrown when the user closes the WebUSB device picker without choosing; not worth an error message. */
export class Cancelled extends Error {
    constructor() {
        super("Cancelled");
        this.name = "Cancelled";
        // keep instanceof working when TypeScript downlevels classes to ES5 (ts-jest)
        Object.setPrototypeOf(this, Cancelled.prototype);
    }
}

/** Wraps failures while turning the preview into pixels, so they get their own explanation. */
export class RenderError extends Error {
    constructor(readonly inner: unknown) {
        super("Render failed");
        this.name = "RenderError";
        Object.setPrototypeOf(this, RenderError.prototype);
    }
}

export const errorName = (error: unknown): string =>
    typeof error === "object" && error !== null && "name" in error ? String((error as { name: unknown }).name) : "";

const messageOf = (error: unknown): string =>
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

/** Turns WebUSB and rendering errors into sentences a user can act on. */
export const friendlyError = (error: unknown): string => {
    if (error instanceof RenderError) {
        const inner = messageOf(error.inner);
        // dom-to-image-more rejects with a bare Event when an image fails to load
        if (/tainted|insecure|cross-origin/i.test(inner) || !(error.inner instanceof Error)) {
            return "An image could not be read. Images from other websites often block this, "
                + "paste the image into the editor instead.";
        }
        return `The receipt could not be rendered (${inner}).`;
    }
    const name = errorName(error);
    const message = messageOf(error);
    if (/user gesture/i.test(message)) {
        return "The browser only shows the printer list after a click. Use the Print or Choose printer button.";
    }
    if (name === "SecurityError" || /access denied/i.test(message)) {
        return "Access to the printer was denied. On Linux, check the udev permissions for the device.";
    }
    if (/claim interface/i.test(message)) {
        return "The printer is in use by another program. On Linux, the usblp kernel driver may be holding it.";
    }
    if (name === "NotFoundError" || /disconnected/i.test(message)) {
        return "The printer was disconnected. Plug it back in and try again.";
    }
    if (name === "NetworkError") {
        return `Sending to the printer failed (${message || name}). Check the cable and try again.`;
    }
    return message || String(error);
};

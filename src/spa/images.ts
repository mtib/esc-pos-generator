/**
 * Scales a pasted or dropped image down to the printable width (never up) and returns it as a data URL.
 * Whichever of PNG and JPEG is smaller wins: everything gets dithered to black and white later anyway.
 */
export const imageFileToDataUrl = async (file: File, maxWidth: number): Promise<{ dataUrl: string, width: number }> => {
    const url = URL.createObjectURL(file);
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const width = Math.max(1, Math.min(maxWidth, image.naturalWidth));
        const height = Math.max(1, Math.round(image.naturalHeight * width / image.naturalWidth));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Failed to get canvas context");
        }
        // transparent areas print as paper, not black
        context.fillStyle = "white";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        const png = canvas.toDataURL("image/png");
        const jpeg = canvas.toDataURL("image/jpeg", 0.85);
        return { dataUrl: png.length <= jpeg.length ? png : jpeg, width };
    } finally {
        URL.revokeObjectURL(url);
    }
};

/**
 * react-use-storage-state swallows quota errors when saving, so after a setter call check
 * whether the stored value really is the new one.
 */
export const isSavedInLocalStorage = (key: string, value: unknown): boolean => {
    try {
        return localStorage.getItem(key) === JSON.stringify(value);
    } catch {
        return false;
    }
};

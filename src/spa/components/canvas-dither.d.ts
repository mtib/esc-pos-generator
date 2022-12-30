type Dither = {
    atkinson(imageData: ImageData): ImageData;
    floydsteinberg(imageData: ImageData): ImageData;
    bayer(imageData: ImageData, threshold: number): ImageData;
    threshold(imageData: ImageData, threshold: number): ImageData;
    grayscale(imageData: ImageData): ImageData;
}
declare module "canvas-dither" {
    const singleton: Dither;
    export default singleton;
}

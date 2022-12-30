declare module "dom-to-image-more" {
    function toPng(node: HTMLElement): Promise<string>;
    function toPixelData(node: HTMLElement): Promise<Uint8Array>;
    function toCanvas(node: HTMLElement): Promise<HTMLCanvasElement>;
}

declare module "*.png" {
    const str: string;
    export default str;
}

declare module "*.html" {
    const html: string;
    export default html;
}

declare module "#rukcord-plugins" {
    const plugins: Record<string, import("./rukcord/plugins/types").rukcordPlugin>;
    export default plugins;
}

declare module "rukcord-build-info" {
    const version: string;
}

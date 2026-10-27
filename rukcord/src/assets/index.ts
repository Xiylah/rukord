import CodebergIcon from "./codeberg.png";
import KofiIcon from "./kofi.png";
// The native loader supplies the bundle URL; do not embed a second PNG in JS.
const RukcordIcon: string = (globalThis as any).__RUKCORD_LOADER__?.iconURL
    ?? "file:///var/jb/Library/Application%20Support/RukcordResources.bundle/rukcord-icon.png";

export { RukcordIcon };
export { CodebergIcon };
export { KofiIcon };

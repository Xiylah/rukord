export const customBuild = {
    version: "v0.6.1a",
    target: "349.0 / 350.0",
    status: "Experimental; device validation pending",
};

export function isTargetDiscord(platform: string, version: unknown): boolean {
    return platform === "ios" && typeof version === "string"
        && /^(?:349|350)\.0(?:\.0)?$/.test(version);
}

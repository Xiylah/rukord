import { readdir, stat, readFile, writeFile, mkdir } from "fs/promises";
import { pluginDescriptor } from "./manifest.mjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");
const pluginsDirectoryPath = path.join(projectRoot, "src/plugins");

// @ts-ignore
async function gatherPlugins(plugins = [], dir = pluginsDirectoryPath, relativePath = "") {
    try {
        const pluginDirs = (await readdir(dir, { recursive: false })).sort();

        for (const pluginDir of pluginDirs) {
            const pluginPath = path.join(dir, pluginDir);
            const stats = await stat(pluginPath);
            if (["_core/badges", "_core/cloudsync", "globalbadges"].includes(
                relativePath ? `${relativePath}/${pluginDir}` : pluginDir)) continue;

            if (stats.isDirectory()) {
                const baseName = path.basename(pluginDir);
                const newRelativePath = relativePath ? `${relativePath}/${pluginDir}` : pluginDir;

                if (baseName.startsWith("_") || baseName.startsWith(".")) {
                    await gatherPlugins(plugins, pluginPath, newRelativePath);
                } else {
                    const pluginId = newRelativePath
                        .split("/")
                        .map(segment => segment.replace(/^[._]/, ""))
                        .filter(segment => segment)
                        .join(".");

                    plugins.push({
                        id: pluginId,
                        relativePath: newRelativePath,
                    });
                }
            }
        }
    } catch (error) {
        console.error("Error gathering plugins:", error);
    }

    return plugins;
}

async function makeModule() {
    const plugins = await gatherPlugins();

    if (plugins.length === 0) {
        console.warn("Warning: No plugins found in", pluginsDirectoryPath);
        return "export default {};";
    }

    const metadata = {};
    const pluginImports = await Promise.all(plugins.map(async ({ id, relativePath }) => {
        const importPath = `./plugins/${relativePath}`;
        const folder = path.join(pluginsDirectoryPath, relativePath);
        const entry = (await readdir(folder)).find(name => /^index\.tsx?$/.test(name));
        if (!entry) throw new Error(`${id}: no plugin entry`);
        const descriptor = pluginDescriptor(await readFile(path.join(folder, entry), "utf8"), entry, id);
        if (!descriptor) return null;
        metadata[id] = descriptor;
        return `${JSON.stringify(id)}: createLazyPlugin(${JSON.stringify(id)}, ${JSON.stringify(descriptor)}, () => require(${JSON.stringify(importPath)}).default)`;
    }));
    await mkdir(path.join(projectRoot,"dist"), {recursive:true});
    await writeFile(path.join(projectRoot,"dist/plugins-manifest.json"), JSON.stringify(metadata,null,2));

    return `
// Auto-generated plugin imports
import { createLazyPlugin } from "./plugins/lazy";
export default {
${pluginImports.filter(Boolean).join(",\n")}
};
    `.trim();
}

export function pluginsImporterPlugin() {
    return {
        name: "rukcord-plugins-importer",
        //@ts-ignore
        setup(build) {
            //@ts-ignore
            build.onResolve({ filter: /^#rukcord-plugins$/ }, args => {
                return {
                    path: path.join(projectRoot, "src/plugins"),
                    namespace: "rukcord-plugins-importer",
                };
            });

            build.onLoad({ filter: /.*/, namespace: "rukcord-plugins-importer" }, async () => {
                return {
                    contents: await makeModule(),
                    loader: "ts",
                    resolveDir: path.join(projectRoot, "src"),
                };
            });
        },
    };
}

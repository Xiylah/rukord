import ts from "typescript";

export function pluginDescriptor(source, filename, id) {
    const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const exported = file.statements.find(n => ts.isExportAssignment(n));
    if (!exported) return null; // Upstream includes commented-out placeholder plugins.
    const object = exported?.expression?.arguments?.[0];
    if (!object || !ts.isObjectLiteralExpression(object)) throw new Error(`${id}: expected export default definePlugin({...})`);
    const properties = new Map(object.properties.map(p => [p.name?.text, p]));
    const text = (key, fallback) => {
        const value = properties.get(key)?.initializer;
        return value && ts.isStringLiteralLike(value) ? value.text : fallback;
    };
    const yes = key => properties.get(key)?.initializer?.kind === ts.SyntaxKind.TrueKeyword;
    const platform = properties.get("platforms")?.initializer;
    const coreNames = {settings:"Settings",painter:"Appearance",corecommands:"Commands",errorboundary:"Recovery",rukcordenhancements:"Rukcord Enhancements"};
    const short = id.split(".").at(-1);
    return {
        name:text("name",coreNames[short] ?? short),
        description:text("description",id.startsWith("core.") ? "Built-in Rukcord module" : "Optional Rukcord feature"),
        version:text("version","1.0.0"),
        hasSettings:properties.has("settings"), hasStart:properties.has("start"), hasEagerStart:properties.has("eagerStart"),
        devOnly:yes("devOnly"), requiresRestart:yes("requiresRestart"),
        ...(platform && ts.isArrayLiteralExpression(platform) ? {platforms:platform.elements.filter(ts.isStringLiteralLike).map(p=>p.text)} : {}),
    };
}

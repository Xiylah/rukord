import { getNativeModule } from "./modules";
import { invokeRukcordBridge } from "./bridge-call";

function legacyRead(payload: object): Promise<any> {
    const bridge = getNativeModule<{
    readAsDataURL(map: object): Promise<any>
        }>("FileReaderModule");
    if (!bridge) throw new Error("No supported Rukcord native bridge is available");
    return bridge.readAsDataURL(payload);
}

export async function callBridgeMethod(method: string, ...args: any[]): Promise<any> {
    try {
        return await invokeRukcordBridge(globalThis, legacyRead, method, args);
    } catch (error) {
        throw new Error(`Call failed: ${error}`);
    }
}

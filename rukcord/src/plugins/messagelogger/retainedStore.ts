// SPDX-License-Identifier: MPL-2.0
import { fileExists, readFile, writeFile } from "@api/native/fs";
import { createRetention } from "./retention";
const path = "plugins/messagelogger-retained.json";
export const retainedMessages = createRetention();
let pending: Promise<unknown> = Promise.resolve();
let timer: ReturnType<typeof setTimeout> | undefined;
export async function loadRetainedMessages(active = () => true) {
    await pending;
    if (!await fileExists(path)) return;
    const data = JSON.parse(await readFile(path));
    if (!active() || data?.version !== 1 || !Array.isArray(data.messages)) return;
    for (const message of data.messages.slice(-500))
        if (message && typeof message.id === "string" && typeof message.channel_id === "string") retainedMessages.set(message);
}
export function flushRetainedMessages() {
    if (timer) clearTimeout(timer);
    timer = undefined;
    let data: string;
    try { data = JSON.stringify({ version: 1, messages: retainedMessages.values() }); }
    catch (error) { console.error("[MessageLogger] Could not serialize local history:", error); return; }
    pending = pending.then(() => writeFile(path, data)).catch(error => console.error("[MessageLogger] Could not save local history:", error));
}
export function saveRetainedMessages() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flushRetainedMessages, 200);
}

import { fileExists, readFile, writeFile } from "@api/native/fs";

const LOG_FILE = "public/message_logs.json";
const MAX_LOGS = 1000;

export interface MessageLogEntry {
    timestamp: string;
    type: "DELETE" | "UPDATE";
    messageId: string;
    channelId: string;
    author: {
        id: string;
        username: string;
        discriminator: string;
        bot: boolean;
    };
    content: string;
    attachments: string[];
}

interface LogData {
    version: number;
    logs: MessageLogEntry[];
}

async function safeParseJSON<T>(data: string | null, fallback: T): Promise<T> {
    if (!data) return fallback;
    try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) || (parsed && typeof parsed === "object" && Array.isArray(parsed.logs))) {
            return parsed as T;
        }
        return fallback;
    } catch {
        return fallback;
    }
}

async function writeLogData(data: LogData): Promise<void> {
    const content = JSON.stringify(data);
    await writeFile(LOG_FILE, content);
}

async function readLogData(): Promise<LogData> {
    const exists = await fileExists(LOG_FILE);
    if (!exists) return { version: 1, logs: [] };

    const content = await readFile(LOG_FILE);
    const parsed = await safeParseJSON<LogData | MessageLogEntry[]>(content, { version: 1, logs: [] });

    if (Array.isArray(parsed)) {
        return { version: 1, logs: parsed };
    }

    return parsed;
}

let pendingWrite: Promise<void> = Promise.resolve();
function serializeWrite(task: () => Promise<void>): Promise<void> {
    const next = pendingWrite.then(task);
    pendingWrite = next.catch(() => {});
    return next;
}

export function addLogEntry(entry: MessageLogEntry): Promise<void> {
    return serializeWrite(async () => {
        const data = await readLogData();
        data.logs = data.logs.slice(-(MAX_LOGS - 1));
        data.logs.push(entry);
        await writeLogData(data);
    });
}

export async function getLogEntries(
    filter?: {
        channelId?: string;
        authorId?: string;
        type?: "DELETE" | "UPDATE";
    },
    limit = 100
): Promise<MessageLogEntry[]> {
    await pendingWrite;
    const data = await readLogData();
    let entries = data.logs;

    if (filter?.channelId) {
        entries = entries.filter(e => e.channelId === filter.channelId);
    }
    if (filter?.authorId) {
        entries = entries.filter(e => e.author.id === filter.authorId);
    }
    if (filter?.type) {
        entries = entries.filter(e => e.type === filter.type);
    }

    return entries.slice(-limit);
}

export async function getLogEntry(messageId: string): Promise<MessageLogEntry | null> {
    await pendingWrite;
    const data = await readLogData();
    return data.logs.find(e => e.messageId === messageId) ?? null;
}

export function clearLogs(): Promise<void> {
    return serializeWrite(() => writeLogData({ version: 1, logs: [] }));
}

export async function repairCorruptedLogs(): Promise<boolean> {
    try {
        const exists = await fileExists(LOG_FILE);
        if (!exists) return true;

        const content = await readFile(LOG_FILE);
        const parsed = await safeParseJSON<LogData | MessageLogEntry[]>(content, { version: 1, logs: [] });

        let logs: MessageLogEntry[];
        if (Array.isArray(parsed)) {
            logs = parsed;
        } else {
            logs = parsed.logs;
        }

        const validLogs = logs.filter((log: MessageLogEntry) => {
            return (
                log &&
                typeof log.messageId === "string" &&
                typeof log.channelId === "string" &&
                typeof log.timestamp === "string" &&
                typeof log.type === "string"
            );
        });

        await serializeWrite(() => writeLogData({ version: 1, logs: validLogs.slice(-MAX_LOGS) }));
        return true;
    } catch {
        return false;
    }
}

export function removeMessageLogs(channelId: string, messageId: string): Promise<void> {
    return serializeWrite(async () => {
        const data = await readLogData();
        await writeLogData({version: 1, logs: data.logs.filter(e => e.channelId !== channelId || e.messageId !== messageId)});
    });
}

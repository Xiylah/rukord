import { createPluginStore } from "@api/storage";

export interface MessageLoggerSettings {
    deleted: {
        enabled: boolean;
        showTimestamps: boolean;
        use12Hour: boolean;
        showOnlyTimestamp: boolean;
    };
    edited: {
        enabled: boolean;
        showSeparator: boolean;
    };
    filters: {
        ignoreBots: boolean;
        ignoreSelfEdits: boolean;
        ignoreSelf: boolean;
    };
    databaseLogging: boolean;
    markDeleted: boolean;
    inlineEdits: boolean;
    logDeletedAttachments: boolean;
    custom: {
        customEditTextEnabled: boolean;
        customDeleteTextEnabled: boolean;
        customEditText: string;
        customDeletedText: string;
    }
    ignoreLists: {
        user: string;
        channel: string;
        guild: string;
    }
}

export const {
    useStore: useMessageLoggerSettings,
    settings: messageLoggerSettings,
} = createPluginStore<MessageLoggerSettings>("messagelogger", {
    deleted: {
        enabled: true,
        showTimestamps: false,
        use12Hour: false,
        showOnlyTimestamp: false,
    },
    edited: {
        enabled: true,
        showSeparator: true,
    },
    filters: {
        ignoreBots: false,
        ignoreSelfEdits: false,
        ignoreSelf: false,
    },
    databaseLogging: false,
    markDeleted: true,
    inlineEdits: true,
    logDeletedAttachments: true,
    custom: {
        customEditTextEnabled: false,
        customDeleteTextEnabled: false,
        customEditText: "`[ EDITED ]`",
        customDeletedText: "This message was deleted",
    },
    ignoreLists: {
        user: "",
        channel: "",
        guild: "",
    }
});

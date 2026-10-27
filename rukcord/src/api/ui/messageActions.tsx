// SPDX-License-Identifier: MPL-2.0
// Mobile action-sheet adapter. Reuse native row components, never web DOM nodes.
import { after, before } from "@api/patcher";
import { componentTarget } from "@api/react/componentTarget";
import { findInReactTree } from "@lib/utils";
import { findByProps } from "@metro";
import { React } from "@metro/common";
import { Forms } from "@metro/common/components";

interface MessageAction {
    id: string;
    label: string;
    visible?: (message: any) => boolean;
    onPress: (message: any) => void | Promise<void>;
}

export function addMessageAction(action: MessageAction): () => void {
    const sheets = findByProps("openLazy", "hideActionSheet");
    if (!sheets || typeof sheets.openLazy !== "function" || typeof sheets.hideActionSheet !== "function") throw new Error("Message action sheets are unavailable on this Discord build");
    let active = true;
    const rendered = new Set<() => unknown>();
    const instances = new Map<object, {message: any; remove?: () => unknown}>();
    const restore = before("openLazy", sheets, ([component, key, context]) => {
        if (key !== "MessageLongPressActionSheet" || !context?.message || !component?.then) return;
        const message = context.message;
        Promise.resolve(component).then((module: any) => {
            if (!active) return;
            const target = componentTarget(module);
            if (!target) return;
            const existing = instances.get(module);
            if (existing) { existing.message = message; return; }
            if (instances.size >= 64) {
                const oldest = instances.keys().next().value!;
                const remove = instances.get(oldest)?.remove;
                if (remove) { remove(); rendered.delete(remove); }
                instances.delete(oldest);
            }
            const state: {message: any; remove?: () => unknown} = {message};
            instances.set(module, state);
            // One lazy component instance can render several times. Keep its row
            // patch until plugin teardown and deduplicate by the native element key.
            const remove = after(target.key, target.parent, (_, tree) => {
                if (!active) return;
                try { if(action.visible && !action.visible(state.message))return; }
                catch(error){console.error(`[${action.id}] Visibility check failed:`,error);return;}
                const press = () => {
                    if (!active) return;
                    sheets.hideActionSheet();
                    try { Promise.resolve(action.onPress(state.message)).catch(error=>console.error(`[${action.id}]`,error)); }
                    catch (error) { console.error(`[${action.id}]`, error); }
                };
                const buttons = findInReactTree(tree, x => Array.isArray(x) && x[0]?.type?.name === "ButtonRow");
                if (buttons && Forms?.FormRow && !buttons.some((row: any) => row?.key === action.id)) {
                    buttons.push(React.createElement(Forms.FormRow, {key: action.id, label: action.label, onPress: press}));
                    return;
                }
                const groups = findInReactTree(tree, x => Array.isArray(x) && x[0]?.type?.name === "ActionSheetRowGroup");
                const children = groups?.[1]?.props?.children;
                if (!Array.isArray(children) || children.some(row => row?.key === action.id)) return;
                const template = children.find(row => React.isValidElement(row) && typeof row.props?.label === "string");
                if (!template) return; // Unsupported layouts leave the stock sheet intact.
                // Use only the native row's type, rather than copying a destructive
                // stock action's props or manufacturing React internal fields.
                children.push(React.createElement(template.type, {
                    key: action.id, label: action.label, onPress: press,
                }));
            });
            state.remove = remove;
            rendered.add(remove);
        }).catch(error => console.error(`[${action.id}] Failed to load action sheet:`, error));
    });
    return () => {
        active = false;
        restore();
        for (const remove of rendered) remove();
        rendered.clear();
        instances.clear();
    };
}

// SPDX-License-Identifier: MPL-2.0
export function shouldMention(userId: string, roles: unknown, settings: {userList?: string; roleList?: string; shouldPingListed?: boolean}): boolean {
    const users = new Set((settings.userList ?? "").split(/[\s,]+/).filter(Boolean));
    const roleIds = new Set((settings.roleList ?? "").split(/[\s,]+/).filter(Boolean));
    const listed = users.has(userId) || Array.isArray(roles) && roles.some(id => roleIds.has(id));
    return settings.shouldPingListed !== false ? listed : !listed;
}

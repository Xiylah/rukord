// SPDX-License-Identifier: MPL-2.0
import { addMessageAction } from "@api/ui/messageActions";
import { ChannelStore, GuildStore } from "@metro/common/stores";
import { definePlugin } from "@plugins";
import { Alert } from "react-native";
let restore:(()=>void)|undefined;
export default definePlugin({id:"serverinfo",name:"ServerInfo",version:"1.0.0-rukcord",
    description:"View cached server metadata from a server message’s menu.",author:[{name:"Rukcord contributors",id:0n}],
    start(){
        if(restore)return;
        if(typeof GuildStore?.getGuild!=="function"||typeof ChannelStore?.getChannel!=="function")throw new Error("Server metadata stores are unavailable");
        const guild=(m:any)=>GuildStore.getGuild(m?.guild_id??m?.guildId??ChannelStore.getChannel(m?.channel_id??m?.channelId)?.guild_id);
        restore=addMessageAction({id:"rukcord-server-info",label:"Server information",visible:m=>!!guild(m),onPress:message=>{
            const g=guild(message);if(!g)return;
            Alert.alert(g.name??"Server",`ID: ${g.id}\nOwner: ${g.ownerId??g.owner_id??"Unknown"}\nVerification level: ${g.verificationLevel??g.verification_level??"Unknown"}\nBoost tier: ${g.premiumTier??g.premium_tier??"Unknown"}`);
        }});
    },stop(){restore?.();restore=undefined;}
});

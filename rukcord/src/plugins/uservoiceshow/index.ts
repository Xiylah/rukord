// SPDX-License-Identifier: MPL-2.0
import { addMessageAction } from "@api/ui/messageActions";
import { findByStoreName } from "@metro";
import { ChannelStore } from "@metro/common/stores";
import { definePlugin } from "@plugins";
import { Alert } from "react-native";
let restore:(()=>void)|undefined;
export default definePlugin({id:"uservoiceshow",name:"UserVoiceShow",version:"1.0.0-rukcord",
    description:"Show a message author’s cached voice channel in the current server. Never joins a call.",author:[{name:"Rukcord contributors",id:0n}],
    start(){
        if(restore)return;
        const voices=findByStoreName("VoiceStateStore");
        if(typeof voices?.getVoiceStateForUser!=="function"||typeof ChannelStore?.getChannel!=="function")throw new Error("Voice-state cache is unavailable");
        const guild=(m:any)=>m?.guild_id??m?.guildId??ChannelStore.getChannel(m?.channel_id??m?.channelId)?.guild_id;
        restore=addMessageAction({id:"rukcord-user-voice",label:"Author’s voice channel",visible:m=>!!m?.author?.id&&!!guild(m),onPress:message=>{
            const state=voices.getVoiceStateForUser(guild(message),message.author.id);
            const channel=ChannelStore.getChannel(state?.channelId??state?.channel_id);
            Alert.alert("Voice channel",channel?.name??"No visible voice channel in this server’s cache.");
        }});
    },stop(){restore?.();restore=undefined;}
});

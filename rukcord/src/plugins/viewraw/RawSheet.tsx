import { ActionSheet } from "@metro/common/components";
import { Dimensions, View } from "react-native";
import RawPage from "./RawPage";
export default function RawSheet({message}: {message: any}) {
    return <ActionSheet><View style={{height: Dimensions.get("window").height * 0.75}}>
        <RawPage message={message} />
    </View></ActionSheet>;
}

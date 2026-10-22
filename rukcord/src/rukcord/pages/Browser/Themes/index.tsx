import { ScrollView } from "react-native";
import { Stack, Text } from "@metro/common/components";
export default function Catalog() {
    return <ScrollView><Stack style={{padding: 24}} spacing={12}>
        <Text variant="heading-lg/semibold">Rukcord Addons</Text>
        <Text variant="text-md/normal">No public catalog is configured. Use Install from URL to add a compatible theme or font.</Text>
    </Stack></ScrollView>;
}

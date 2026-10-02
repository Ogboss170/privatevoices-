import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../../constants/colors'

export default function CreateScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>✏️</Text>
      <Text style={styles.title}>Create</Text>
      <Text style={styles.body}>Write posts and stories — coming in Phase 2 & 6.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gray50, padding: 32 },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.gray900, marginBottom: 8 },
  body: { fontSize: 14, color: colors.gray500, textAlign: 'center', lineHeight: 20 },
})

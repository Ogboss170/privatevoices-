import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../../constants/colors'

export default function ExploreScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🔍</Text>
      <Text style={styles.title}>Explore</Text>
      <Text style={styles.body}>Discover people, posts, communities and hashtags — coming in Phase 7.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gray50, padding: 32 },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.gray900, marginBottom: 8 },
  body: { fontSize: 14, color: colors.gray500, textAlign: 'center', lineHeight: 20 },
})

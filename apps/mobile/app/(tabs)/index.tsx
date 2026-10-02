import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../../constants/colors'

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      {/* Feed tabs — Phase 2 */}
      <View style={styles.tabRow}>
        {['For You', 'Following', 'Trending', 'Latest'].map((tab, i) => (
          <Text
            key={tab}
            style={[styles.tab, i === 0 && styles.tabActive]}
          >
            {tab}
          </Text>
        ))}
      </View>

      {/* Empty state */}
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>✨</Text>
        <Text style={styles.emptyTitle}>Your feed is ready</Text>
        <Text style={styles.emptyBody}>
          Follow people and join communities to see posts here.{'\n'}
          Posts are coming in Phase 2.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  tabRow: {
    flexDirection: 'row', backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.gray200,
  },
  tab: {
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, fontWeight: '500', color: colors.gray500,
  },
  tabActive: {
    color: colors.brand,
    borderBottomWidth: 2, borderBottomColor: colors.brand,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.gray900, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: colors.gray500, textAlign: 'center', lineHeight: 20 },
})

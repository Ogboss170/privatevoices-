import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { Image } from 'expo-image'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

interface MentionSuggestionsProps {
  query: string
  visible: boolean
  onSelect: (username: string) => void
}

export function MentionSuggestions({ query, visible, onSelect }: MentionSuggestionsProps) {
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible || !query) {
      setMatches([])
      return
    }

    let active = true

    async function searchUsers() {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .ilike('username', `${query}%`)
          .limit(6)

        if (active) {
          setMatches(data || [])
        }
      } catch (err) {
        console.error('Error searching mentions:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    const timer = setTimeout(searchUsers, 150)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query, visible])

  if (!visible || (matches.length === 0 && !loading)) return null

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {loading && matches.length === 0 ? (
          <ActivityIndicator size="small" color={colors.brand} style={{ paddingHorizontal: 12 }} />
        ) : (
          matches.map((user) => (
            <TouchableOpacity
              key={user.id}
              style={styles.chip}
              onPress={() => onSelect(user.username)}
              activeOpacity={0.7}
            >
              <View style={styles.avatar}>
                {user.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>
                    {(user.display_name || user.username).charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <Text style={styles.username}>@{user.username}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    gap: 6,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 20,
    height: 20,
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.brand,
  },
  username: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray900,
  },
})

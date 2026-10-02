import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Send, Image as ImageIcon } from 'lucide-react-native'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'

export default function CreateScreen() {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  async function handlePublish() {
    if (!content.trim()) return
    setLoading(true)

    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
      Alert.alert('Error', 'You must be logged in to create a post.')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('posts').insert({
      author_id: user.user.id,
      content: content.trim(),
    })

    setLoading(false)

    if (error) {
      Alert.alert('Post failed', error.message)
    } else {
      setContent('')
      router.push('/(tabs)')
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          multiline
          placeholder="What's on your mind? Speak freely..."
          placeholderTextColor={colors.gray400}
          value={content}
          onChangeText={setContent}
          maxLength={1000}
        />

        <View style={styles.footer}>
          <TouchableOpacity style={styles.iconBtn}>
            <ImageIcon size={20} color={colors.gray400} />
          </TouchableOpacity>

          <View style={styles.rightGroup}>
            <Text style={styles.counter}>{content.length}/1000</Text>
            <TouchableOpacity
              style={[styles.publishBtn, (!content.trim() || loading) && styles.disabledBtn]}
              onPress={handlePublish}
              disabled={!content.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={styles.btnRow}>
                  <Text style={styles.publishText}>Post</Text>
                  <Send size={14} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50, padding: 16 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
    minHeight: 200,
    justifyContent: 'space-between',
  },
  input: {
    fontSize: 16,
    color: colors.gray900,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  iconBtn: { padding: 8 },
  rightGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counter: { fontSize: 12, color: colors.gray400 },
  publishBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  disabledBtn: { opacity: 0.5 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  publishText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
})

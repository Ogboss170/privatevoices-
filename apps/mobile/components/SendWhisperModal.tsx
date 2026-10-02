import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { X, Send, Lock } from 'lucide-react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

interface SendWhisperModalProps {
  visible: boolean
  recipientId: string
  recipientUsername: string
  recipientDisplayName: string
  onClose: () => void
}

export function SendWhisperModal({
  visible,
  recipientId,
  recipientUsername,
  recipientDisplayName,
  onClose,
}: SendWhisperModalProps) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSend() {
    if (!content.trim()) return
    setLoading(true)

    const { error } = await supabase.from('whispers').insert({
      recipient_id: recipientId,
      content: content.trim(),
    })

    setLoading(false)

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setSent(true)
    }
  }

  function handleClose() {
    setContent('')
    setSent(false)
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.emoji}>🤫</Text>
              <View>
                <Text style={styles.title}>Send Anonymous Whisper</Text>
                <Text style={styles.subtitle}>To @{recipientUsername}</Text>
              </View>
            </View>

            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <X size={20} color={colors.gray500} />
            </TouchableOpacity>
          </View>

          {sent ? (
            <View style={styles.sentContainer}>
              <Text style={styles.sentEmoji}>📬</Text>
              <Text style={styles.sentTitle}>Whisper Sent!</Text>
              <Text style={styles.sentDesc}>
                Your message was delivered anonymously. @{recipientUsername} will not see your identity.
              </Text>
              <TouchableOpacity style={styles.doneBtn} onPress={handleClose}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                multiline
                maxLength={500}
                placeholder={`Write something honest or inspiring for ${recipientDisplayName}...`}
                placeholderTextColor={colors.gray400}
                value={content}
                onChangeText={setContent}
              />

              <View style={styles.metaRow}>
                <View style={styles.lockInfo}>
                  <Lock size={12} color={colors.gray400} />
                  <Text style={styles.lockText}>Your identity is kept completely private</Text>
                </View>
                <Text style={styles.counter}>{content.length}/500</Text>
              </View>

              <View style={styles.footer}>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sendBtn, (!content.trim() || loading) && styles.disabledBtn]}
                  onPress={handleSend}
                  disabled={!content.trim() || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <View style={styles.btnRow}>
                      <Text style={styles.sendText}>Send</Text>
                      <Send size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emoji: { fontSize: 24 },
  title: { fontSize: 16, fontWeight: '700', color: colors.gray900 },
  subtitle: { fontSize: 12, color: colors.gray500 },
  closeBtn: { padding: 4 },
  form: { gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.gray900,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lockInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockText: { fontSize: 11, color: colors.gray400 },
  counter: { fontSize: 11, color: colors.gray400 },
  footer: { flexDirection: 'row', gap: 12, paddingTop: 12 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '600', color: colors.gray700 },
  sendBtn: {
    flex: 1,
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: { opacity: 0.5 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sendText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  sentContainer: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  sentEmoji: { fontSize: 48 },
  sentTitle: { fontSize: 18, fontWeight: '700', color: colors.gray900 },
  sentDesc: { fontSize: 13, color: colors.gray500, textAlign: 'center', paddingHorizontal: 16 },
  doneBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  doneText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
})

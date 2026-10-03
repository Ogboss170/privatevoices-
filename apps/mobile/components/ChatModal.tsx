import React, { useState, useEffect, useRef } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Send, Check, CheckCheck } from 'lucide-react-native'
import { Image } from 'expo-image'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

interface ChatPartner {
  id: string
  username: string
  displayName?: string
  display_name?: string
  avatarUrl?: string | null
  avatar_url?: string | null
}

interface ChatModalProps {
  visible: boolean
  conversationId: string
  partner: ChatPartner | null
  currentUserId: string
  onClose: () => void
}

export function ChatModal({
  visible,
  conversationId,
  partner,
  currentUserId,
  onClose,
}: ChatModalProps) {
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  const partnerName = partner?.displayName || partner?.display_name || partner?.username || 'User'
  const partnerUsername = partner?.username || 'user'
  const partnerAvatar = partner?.avatarUrl || partner?.avatar_url || null

  useEffect(() => {
    if (!visible || !conversationId) return

    async function loadMessages() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('Error loading messages:', error)
        } else {
          setMessages(data ?? [])
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: false })
          }, 150)
        }

        // Mark unread messages as read
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('conversation_id', conversationId)
          .neq('sender_id', currentUserId)
      } catch (err) {
        console.error('Failed to load messages:', err)
      } finally {
        setLoading(false)
      }
    }

    loadMessages()

    // Realtime subscription for incoming messages
    const channel = supabase
      .channel(`chat-mobile:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true })
          }, 100)

          // Auto-mark incoming message as read
          if (payload.new.sender_id !== currentUserId) {
            supabase
              .from('messages')
              .update({ is_read: true })
              .eq('id', payload.new.id)
              .then(() => {})
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [visible, conversationId, currentUserId])

  async function handleSend() {
    if (!text.trim() || sending || !conversationId) return

    const messageContent = text.trim()
    setText('')
    setSending(true)

    // Optimistic message
    const tempId = `temp-${Date.now()}`
    const optimisticMsg = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: messageContent,
      is_read: false,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimisticMsg])
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true })
    }, 50)

    try {
      const { data: newMsg, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: messageContent,
        })
        .select('*')
        .single()

      if (error) {
        console.error('Failed to send message:', error)
        // Rollback optimistic message
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        Alert.alert('Send Failed', error.message || 'Unable to send message.')
      } else if (newMsg) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? newMsg : m)))

        // Update conversation last_message & timestamp
        await supabase
          .from('conversations')
          .update({
            last_message: messageContent,
            last_message_at: new Date().toISOString(),
          })
          .eq('id', conversationId)
      }
    } catch (err: any) {
      console.error('Error sending message:', err)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      Alert.alert('Send Failed', err.message || 'Network error sending message.')
    } finally {
      setSending(false)
    }
  }

  function formatTime(isoString: string) {
    try {
      const date = new Date(isoString)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarCircle}>
                {partnerAvatar ? (
                  <Image source={{ uri: partnerAvatar }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarLetter}>
                    {partnerName.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.headerName} numberOfLines={1}>
                  {partnerName}
                </Text>
                <Text style={styles.headerUsername} numberOfLines={1}>
                  @{partnerUsername}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={22} color={colors.gray700} />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <View style={styles.messagesContainer}>
            {loading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={colors.brand} />
                <Text style={styles.loadingText}>Loading conversation...</Text>
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.centerBox}>
                <Text style={styles.emptyEmoji}>👋</Text>
                <Text style={styles.emptyTitle}>Say hello to {partnerName}!</Text>
                <Text style={styles.emptyDesc}>
                  Start your conversation. Direct messages are private and identity-verified.
                </Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                renderItem={({ item }) => {
                  const isMe = item.sender_id === currentUserId
                  const isTemp = String(item.id).startsWith('temp-')

                  return (
                    <View
                      style={[
                        styles.messageRow,
                        isMe ? styles.messageRowMe : styles.messageRowThem,
                      ]}
                    >
                      <View
                        style={[
                          styles.bubble,
                          isMe ? styles.bubbleMe : styles.bubbleThem,
                          isTemp && styles.bubblePending,
                        ]}
                      >
                        <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextThem]}>
                          {item.content}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.metaRow,
                          isMe ? styles.metaRowMe : styles.metaRowThem,
                        ]}
                      >
                        <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
                        {isMe && !isTemp && (
                          <View style={styles.receiptContainer}>
                            {item.is_read ? (
                              <CheckCheck size={13} color={colors.brand} />
                            ) : (
                              <Check size={13} color={colors.gray400} />
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  )
                }}
              />
            )}
          </View>

          {/* Input Bar */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              placeholder={`Message @${partnerUsername}...`}
              placeholderTextColor={colors.gray400}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
            />

            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!text.trim() || sending) && styles.sendBtnDisabled,
              ]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Send size={18} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 40,
    height: 40,
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.brand,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
  },
  headerUsername: {
    fontSize: 12,
    color: colors.gray500,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.gray100,
  },
  messagesContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.gray500,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray800,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  messageRow: {
    maxWidth: '82%',
    marginBottom: 4,
  },
  messageRowMe: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageRowThem: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMe: {
    backgroundColor: colors.brand,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.gray200,
    borderBottomLeftRadius: 4,
  },
  bubblePending: {
    opacity: 0.75,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextMe: {
    color: '#ffffff',
  },
  messageTextThem: {
    color: colors.gray900,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    paddingHorizontal: 4,
    gap: 4,
  },
  metaRowMe: {
    justifyContent: 'flex-end',
  },
  metaRowThem: {
    justifyContent: 'flex-start',
  },
  timeText: {
    fontSize: 10,
    color: colors.gray400,
  },
  receiptContainer: {
    marginLeft: 2,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: colors.gray50,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.gray900,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.gray300,
  },
})

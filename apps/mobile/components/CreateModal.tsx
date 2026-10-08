import React, { useRef, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Animated as RNAnimated,
} from 'react-native'
import { useRouter } from 'expo-router'
import { FileText, Ghost, BookOpen, Users, X } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export const CREATE_OPTIONS = [
  {
    id: 'post',
    label: 'New Post',
    sublabel: 'Share a voice with your feed',
    Icon: FileText,
    color: '#3b82f6',
    route: '/create',
  },
  {
    id: 'whisper',
    label: 'Anonymous Whisper',
    sublabel: 'Send an anonymous message',
    Icon: Ghost,
    color: '#8b5cf6',
    route: '/whispers/new',
  },
  {
    id: 'story',
    label: 'Story',
    sublabel: '24-hour disappearing post',
    Icon: BookOpen,
    color: '#ec4899',
    route: '/create?type=story',
  },
  {
    id: 'community',
    label: 'Community Post',
    sublabel: 'Post in a community',
    Icon: Users,
    color: '#10b981',
    route: '/create?type=community',
  },
] as const

interface CreateModalProps {
  visible: boolean
  onClose: () => void
}

export function CreateModal({ visible, onClose }: CreateModalProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const slideAnim = useRef(new RNAnimated.Value(300)).current

  useEffect(() => {
    if (visible) {
      RNAnimated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 180,
      }).start()
    } else {
      RNAnimated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start()
    }
  }, [visible])

  const handleOption = (route: string) => {
    onClose()
    setTimeout(() => {
      router.push(route as any)
    }, 80)
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <RNAnimated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom + 8, 16), transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Create</Text>
            <TouchableOpacity onPress={onClose} style={styles.sheetClose}>
              <X size={18} color="#6b7280" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Options */}
          {CREATE_OPTIONS.map((option) => {
            const IconComp = option.Icon
            return (
              <TouchableOpacity
                key={option.id}
                style={styles.sheetOption}
                onPress={() => handleOption(option.route)}
                activeOpacity={0.7}
              >
                <View style={[styles.sheetOptionIcon, { backgroundColor: option.color + '18' }]}>
                  <IconComp size={22} color={option.color} strokeWidth={2} />
                </View>
                <View style={styles.sheetOptionText}>
                  <Text style={styles.sheetOptionLabel}>{option.label}</Text>
                  <Text style={styles.sheetOptionSub}>{option.sublabel}</Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </RNAnimated.View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  sheetClose: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  sheetOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionText: {
    flex: 1,
  },
  sheetOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  sheetOptionSub: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 1,
  },
})

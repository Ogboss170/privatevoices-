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
  SafeAreaView,
  ScrollView,
  Image,
  Modal,
} from 'react-native'
import { useRouter } from 'expo-router'
import {
  Image as ImageIcon,
  Camera,
  Smile,
  BarChart2,
  X,
  Globe,
  Users,
  Lock,
  ChevronDown,
} from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'

const AUDIENCE_OPTIONS = [
  { id: 'everyone', label: 'Everyone', icon: Globe },
  { id: 'followers', label: 'Followers', icon: Users },
  { id: 'close_friends', label: 'Close Friends', icon: Lock },
]

export default function CreateScreen() {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedAudience, setSelectedAudience] = useState('everyone')
  const [showAudienceModal, setShowAudienceModal] = useState(false)
  const [mediaItems, setMediaItems] = useState<string[]>([])
  
  // Poll state
  const [showPollCreator, setShowPollCreator] = useState(false)
  const [pollOptions, setPollOptions] = useState(['', ''])

  const handleCancel = () => {
    if (content.trim() || mediaItems.length > 0 || pollOptions.some((o) => o.trim())) {
      Alert.alert(
        'Discard Post?',
        'If you leave now, your draft will be discarded.',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setContent('')
              setMediaItems([])
              setShowPollCreator(false)
              router.back()
            },
          },
        ]
      )
    } else {
      router.back()
    }
  }

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Permission to access gallery is required!')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    })

    if (!result.canceled) {
      const newUris = result.assets.map((asset) => asset.uri)
      setMediaItems((prev) => [...prev, ...newUris])
    }
  }

  const openCamera = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync()
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Permission to access camera is required!')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]?.uri) {
      setMediaItems((prev) => [...prev, result.assets[0].uri])
    }
  }

  const removeMedia = (index: number) => {
    setMediaItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handlePublish() {
    if (!content.trim() && mediaItems.length === 0) return
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
      setMediaItems([])
      router.back()
    }
  }

  const audienceLabel = AUDIENCE_OPTIONS.find((a) => a.id === selectedAudience)?.label || 'Everyone'

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Top Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>New Voice</Text>

          <TouchableOpacity
            style={[
              styles.postBtn,
              (!content.trim() && mediaItems.length === 0) || loading ? styles.disabledBtn : null,
            ]}
            onPress={handlePublish}
            disabled={(!content.trim() && mediaItems.length === 0) || loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.postBtnText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Composer Main Body */}
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* User Header & Audience Selector */}
          <View style={styles.userInfoRow}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>G</Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.displayName}>Ghost</Text>
              <TouchableOpacity
                style={styles.audienceBadge}
                onPress={() => setShowAudienceModal(true)}
              >
                <Globe size={12} color={colors.brand} />
                <Text style={styles.audienceText}>{audienceLabel}</Text>
                <ChevronDown size={12} color={colors.brand} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Autogrow Text Input */}
          <TextInput
            style={styles.input}
            multiline
            placeholder="What's on your mind? Speak freely..."
            placeholderTextColor={colors.gray400}
            value={content}
            onChangeText={setContent}
            maxLength={500}
          />

          {/* Media Previews */}
          {mediaItems.length > 0 && (
            <ScrollView horizontal style={styles.mediaContainer} showsHorizontalScrollIndicator={false}>
              {mediaItems.map((uri, idx) => (
                <View key={idx} style={styles.mediaItemWrapper}>
                  <Image source={{ uri }} style={styles.mediaThumbnail} />
                  <TouchableOpacity style={styles.removeMediaBtn} onPress={() => removeMedia(idx)}>
                    <X size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Poll Creator */}
          {showPollCreator && (
            <View style={styles.pollCard}>
              <View style={styles.pollHeader}>
                <Text style={styles.pollTitle}>Create a Poll</Text>
                <TouchableOpacity onPress={() => setShowPollCreator(false)}>
                  <X size={16} color={colors.gray500} />
                </TouchableOpacity>
              </View>
              {pollOptions.map((opt, idx) => (
                <TextInput
                  key={idx}
                  style={styles.pollInput}
                  placeholder={`Option ${idx + 1}`}
                  placeholderTextColor={colors.gray400}
                  value={opt}
                  onChangeText={(val) => {
                    const newOpts = [...pollOptions]
                    newOpts[idx] = val
                    setPollOptions(newOpts)
                  }}
                />
              ))}
              {pollOptions.length < 4 && (
                <TouchableOpacity
                  style={styles.addPollOptionBtn}
                  onPress={() => setPollOptions([...pollOptions, ''])}
                >
                  <Text style={styles.addPollOptionText}>+ Add Option</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>

        {/* Bottom Attachment Toolbar & Character Counter */}
        <View style={styles.toolbarContainer}>
          <View style={styles.toolbar}>
            <TouchableOpacity style={styles.toolbarItem} onPress={pickImage}>
              <ImageIcon size={22} color={colors.gray600} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarItem} onPress={openCamera}>
              <Camera size={22} color={colors.gray600} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolbarItem}
              onPress={() => Alert.alert('GIFs', 'GIF selector coming soon!')}
            >
              <Text style={styles.gifBadge}>GIF</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolbarItem}
              onPress={() => Alert.alert('Emoji', 'Use system keyboard for emoji!')}
            >
              <Smile size={22} color={colors.gray600} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolbarItem}
              onPress={() => setShowPollCreator(!showPollCreator)}
            >
              <BarChart2 size={22} color={colors.gray600} />
            </TouchableOpacity>
          </View>

          <Text style={styles.charCounter}>{content.length} / 500</Text>
        </View>
      </KeyboardAvoidingView>

      {/* Audience Selector Modal */}
      <Modal visible={showAudienceModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowAudienceModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Who can see this Voice?</Text>
            {AUDIENCE_OPTIONS.map((opt) => {
              const IconComp = opt.icon
              const isSelected = selectedAudience === opt.id
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.audienceOption, isSelected && styles.audienceOptionSelected]}
                  onPress={() => {
                    setSelectedAudience(opt.id)
                    setShowAudienceModal(false)
                  }}
                >
                  <IconComp size={18} color={isSelected ? colors.brand : colors.gray600} />
                  <Text
                    style={[
                      styles.audienceOptionText,
                      isSelected && styles.audienceOptionTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  headerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  cancelText: {
    fontSize: 16,
    color: colors.gray600,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
  },
  postBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  postBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userDetails: {
    justifyContent: 'center',
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 2,
  },
  audienceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  audienceText: {
    fontSize: 12,
    color: colors.brand,
    fontWeight: '500',
  },
  input: {
    fontSize: 17,
    color: colors.gray900,
    minHeight: 120,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  mediaContainer: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 12,
  },
  mediaItemWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  mediaThumbnail: {
    width: 90,
    height: 90,
    borderRadius: 12,
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollCard: {
    backgroundColor: colors.gray50,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  pollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pollTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray800,
  },
  pollInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.gray900,
    marginBottom: 6,
  },
  addPollOptionBtn: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  addPollOptionText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '500',
  },
  toolbarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    backgroundColor: '#ffffff',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  toolbarItem: {
    padding: 4,
  },
  gifBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.gray600,
    borderWidth: 1.5,
    borderColor: colors.gray600,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  charCounter: {
    fontSize: 12,
    color: colors.gray500,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 16,
  },
  audienceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 12,
  },
  audienceOptionSelected: {
    backgroundColor: '#EEF2FF',
  },
  audienceOptionText: {
    fontSize: 15,
    color: colors.gray700,
  },
  audienceOptionTextSelected: {
    color: colors.brand,
    fontWeight: '600',
  },
})


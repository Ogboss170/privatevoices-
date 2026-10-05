import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { X, Lock, Globe, Camera } from 'lucide-react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

interface EditProfileModalProps {
  visible: boolean
  initialProfile: {
    displayName: string
    bio: string | null
    isPrivate: boolean
    avatarUrl?: string | null
  }
  onClose: () => void
  onUpdated: () => void
}

export function EditProfileModal({
  visible,
  initialProfile,
  onClose,
  onUpdated,
}: EditProfileModalProps) {
  const [displayName, setDisplayName] = useState(initialProfile.displayName)
  const [bio, setBio] = useState(initialProfile.bio ?? '')
  const [isPrivate, setIsPrivate] = useState(initialProfile.isPrivate)
  const [avatarUri, setAvatarUri] = useState<string | null>(initialProfile.avatarUrl || null)
  const [loading, setLoading] = useState(false)

  const handlePickAvatar = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Permission to access gallery is required!')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri)
    }
  }

  async function handleSave() {
    if (!displayName.trim()) return
    setLoading(true)

    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
      setLoading(false)
      return
    }

    let uploadedAvatarUrl = initialProfile.avatarUrl || null

    if (avatarUri && avatarUri !== initialProfile.avatarUrl) {
      try {
        const fileExt = avatarUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg'
        const fileName = `${user.user.id}/avatar_${Date.now()}.${fileExt}`

        const response = await fetch(avatarUri)
        const blob = await response.blob()
        const arrayBuffer = await new Response(blob).arrayBuffer()

        let uploadRes = await supabase.storage
          .from('avatars')
          .upload(fileName, arrayBuffer, {
            contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
            upsert: true,
          })

        if (uploadRes.error) {
          uploadRes = await supabase.storage
            .from('post-media')
            .upload(`avatars/${fileName}`, arrayBuffer, {
              contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
              upsert: true,
            })
        }

        if (uploadRes.data) {
          const bucket = uploadRes.data.path.startsWith('avatars/') ? 'post-media' : 'avatars'
          const { data: publicUrlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(uploadRes.data.path)

          uploadedAvatarUrl = publicUrlData.publicUrl
        }
      } catch (err) {
        console.error('Error uploading avatar:', err)
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        avatar_url: uploadedAvatarUrl,
        bio: bio.trim() || null,
        is_private: isPrivate,
      })
      .eq('id', user.user.id)

    setLoading(false)

    if (error) {
      Alert.alert('Update failed', error.message)
    } else {
      onUpdated()
      onClose()
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Profile</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.gray500} />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {/* Avatar Photo Picker */}
            <View style={styles.avatarPickerContainer}>
              <TouchableOpacity style={styles.avatarCircle} onPress={handlePickAvatar} activeOpacity={0.8}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarLetter}>{displayName.charAt(0).toUpperCase() || 'U'}</Text>
                )}
                <View style={styles.cameraOverlay}>
                  <Camera size={16} color="#ffffff" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePickAvatar}>
                <Text style={styles.changeAvatarText}>Change Profile Photo</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={colors.gray400}
            />

            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              multiline
              maxLength={160}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell the world about yourself..."
              placeholderTextColor={colors.gray400}
            />
            <Text style={styles.counter}>{bio.length}/160</Text>

            <View style={styles.privacyRow}>
              <View style={styles.privacyInfo}>
                {isPrivate ? (
                  <Lock size={20} color={colors.brand} />
                ) : (
                  <Globe size={20} color={colors.gray500} />
                )}
                <View>
                  <Text style={styles.privacyTitle}>Private Account</Text>
                  <Text style={styles.privacyDesc}>
                    Only approved followers can see your posts
                  </Text>
                </View>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: colors.gray300, true: colors.brand }}
              />
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, loading && styles.disabledBtn]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
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
  title: { fontSize: 18, fontWeight: '700', color: colors.gray900 },
  closeBtn: { padding: 4 },
  form: { gap: 12 },
  avatarPickerContainer: {
    alignItems: 'center',
    marginVertical: 4,
    gap: 8,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 72,
    height: 72,
  },
  avatarLetter: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.brand,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.brand,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.gray700 },
  input: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.gray900,
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  counter: { fontSize: 11, color: colors.gray400, textAlign: 'right', marginTop: -8 },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.gray50,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
    marginTop: 8,
  },
  privacyInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  privacyTitle: { fontSize: 14, fontWeight: '700', color: colors.gray900 },
  privacyDesc: { fontSize: 11, color: colors.gray500 },
  footer: { flexDirection: 'row', gap: 12, paddingTop: 12 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '600', color: colors.gray700 },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabledBtn: { opacity: 0.6 },
  saveText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
})

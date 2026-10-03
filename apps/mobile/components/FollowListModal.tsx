import React, { useState, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { X, Lock, UserPlus, UserCheck } from 'lucide-react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

interface FollowUser {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  bio?: string | null
}

interface FollowListModalProps {
  visible: boolean
  onClose: () => void
  targetUserId: string
  targetUsername: string
  initialTab?: 'followers' | 'following'
  canView: boolean
  currentUserId?: string | null
}

export function FollowListModal({
  visible,
  onClose,
  targetUserId,
  targetUsername,
  initialTab = 'followers',
  canView,
  currentUserId,
}: FollowListModalProps) {
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab)
  const [users, setUsers] = useState<FollowUser[]>([])
  const [loading, setLoading] = useState(false)
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab, visible])

  useEffect(() => {
    if (!visible || !canView || !targetUserId) return

    async function loadList() {
      setLoading(true)
      try {
        let userList: FollowUser[] = []

        if (activeTab === 'followers') {
          const { data, error } = await supabase
            .from('follows')
            .select('follower:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, bio)')
            .eq('following_id', targetUserId)

          if (!error && data) {
            userList = data
              .map((row: any) => row.follower)
              .filter(Boolean)
              .map((u: any) => ({
                id: u.id,
                username: u.username,
                displayName: u.display_name,
                avatarUrl: u.avatar_url,
                bio: u.bio,
              }))
          }
        } else {
          const { data, error } = await supabase
            .from('follows')
            .select('following:profiles!follows_following_id_fkey(id, username, display_name, avatar_url, bio)')
            .eq('follower_id', targetUserId)

          if (!error && data) {
            userList = data
              .map((row: any) => row.following)
              .filter(Boolean)
              .map((u: any) => ({
                id: u.id,
                username: u.username,
                displayName: u.display_name,
                avatarUrl: u.avatar_url,
                bio: u.bio,
              }))
          }
        }

        if (currentUserId && userList.length > 0) {
          const otherIds = userList.map((u) => u.id).filter((id) => id !== currentUserId)
          if (otherIds.length > 0) {
            const { data: myFollows } = await supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', currentUserId)
              .in('following_id', otherIds)

            const map: Record<string, boolean> = {}
            for (const f of myFollows || []) {
              map[f.following_id] = true
            }
            setFollowingMap(map)
          }
        }

        setUsers(userList)
      } catch (err) {
        console.error('Error fetching follow list:', err)
      } finally {
        setLoading(false)
      }
    }

    loadList()
  }, [visible, canView, activeTab, targetUserId, currentUserId])

  async function handleToggleFollow(userId: string) {
    if (!currentUserId) {
      Alert.alert('Login Required', 'Please log in to follow users.')
      return
    }

    const isCurrentlyFollowing = !!followingMap[userId]

    setFollowingMap((prev) => ({
      ...prev,
      [userId]: !isCurrentlyFollowing,
    }))

    try {
      if (isCurrentlyFollowing) {
        await supabase
          .from('follows')
          .delete()
          .match({ follower_id: currentUserId, following_id: userId })
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: currentUserId, following_id: userId })
      }
    } catch {
      setFollowingMap((prev) => ({
        ...prev,
        [userId]: isCurrentlyFollowing,
      }))
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>@{targetUsername}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.gray600} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'followers' && styles.tabBtnActive]}
              onPress={() => setActiveTab('followers')}
            >
              <Text
                style={[styles.tabText, activeTab === 'followers' && styles.tabTextActive]}
              >
                Followers
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'following' && styles.tabBtnActive]}
              onPress={() => setActiveTab('following')}
            >
              <Text
                style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]}
              >
                Following
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {!canView ? (
            <View style={styles.privateBox}>
              <View style={styles.lockCircle}>
                <Lock size={28} color={colors.brand} />
              </View>
              <Text style={styles.privateTitle}>This Account is Private</Text>
              <Text style={styles.privateDesc}>
                Follow @{targetUsername} to see who they follow and who follows them.
              </Text>
            </View>
          ) : loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.brand} />
              <Text style={styles.loadingText}>Loading {activeTab}...</Text>
            </View>
          ) : users.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>👥</Text>
              <Text style={styles.emptyTitle}>No {activeTab} yet</Text>
              <Text style={styles.emptyDesc}>
                {activeTab === 'followers'
                  ? `@${targetUsername} does not have any followers yet.`
                  : `@${targetUsername} is not following anyone yet.`}
              </Text>
            </View>
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => {
                const isMe = currentUserId === item.id
                const isFollowing = !!followingMap[item.id]

                return (
                  <View style={styles.userRow}>
                    <View style={styles.userInfo}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarLetter}>
                          {item.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.displayName}>{item.displayName}</Text>
                        <Text style={styles.username}>@{item.username}</Text>
                      </View>
                    </View>

                    {currentUserId && !isMe && (
                      <TouchableOpacity
                        style={[styles.followBtn, isFollowing && styles.followingBtn]}
                        onPress={() => handleToggleFollow(item.id)}
                      >
                        {isFollowing ? (
                          <>
                            <UserCheck size={14} color={colors.gray700} />
                            <Text style={styles.followingBtnText}>Following</Text>
                          </>
                        ) : (
                          <>
                            <UserPlus size={14} color="#ffffff" />
                            <Text style={styles.followBtnText}>Follow</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '75%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
  },
  closeBtn: {
    padding: 6,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#fafafa',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: colors.brand,
    backgroundColor: '#ffffff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray500,
  },
  tabTextActive: {
    color: colors.brand,
    fontWeight: '700',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: colors.gray400,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray800,
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12,
    color: colors.gray400,
    textAlign: 'center',
  },
  privateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  lockCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  privateTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 8,
  },
  privateDesc: {
    fontSize: 13,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 18,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.brand,
  },
  displayName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray900,
  },
  username: {
    fontSize: 12,
    color: colors.gray500,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  followBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  followingBtn: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  followingBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray700,
  },
})

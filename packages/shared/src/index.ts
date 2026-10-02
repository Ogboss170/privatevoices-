// ─── User / Profile ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  createdAt: string;
}

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
}

// ─── Privacy Settings ───────────────────────────────────────────────────────────

export type FollowVisibility = 'anyone' | 'nobody';
export type MessageVisibility = 'anyone' | 'followers' | 'nobody';
export type WhisperVisibility = 'anyone' | 'followers' | 'nobody';
export type StoryVisibility = 'everyone' | 'followers' | 'close_friends' | 'custom';
export type CommentVisibility = 'anyone' | 'followers' | 'nobody';
export type MentionVisibility = 'anyone' | 'followers' | 'nobody';

export interface PrivacySettings {
  id: string;
  userId: string;
  whoCanFollow: FollowVisibility;
  whoCanMessage: MessageVisibility;
  whisperVisibility: WhisperVisibility;
  storyVisibility: StoryVisibility;
  whoCanComment: CommentVisibility;
  whoCanMention: MentionVisibility;
  showInRecommendations: boolean;
  allowProfileIndexing: boolean;
}

// ─── Phase 2: Social Feed, Posts, Comments ──────────────────────────────────────

export type FeedType = 'for-you' | 'following' | 'trending' | 'latest';

export interface PostAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Post {
  id: string;
  authorId: string;
  author: PostAuthor;
  content: string;
  imageUrls: string[];
  hashtags: string[];
  likeCount: number;
  commentCount: number;
  repostCount: number;
  isLikedByMe: boolean;
  isSavedByMe: boolean;
  isRepostedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostDto {
  content: string;
  imageUrls?: string[];
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  author: PostAuthor;
  content: string;
  createdAt: string;
}

export interface CreateCommentDto {
  postId: string;
  content: string;
}

export interface ReportContentDto {
  targetType: 'post' | 'comment' | 'profile';
  targetId: string;
  reason: string;
  details?: string;
}

// ─── Auth ───────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SignUpDto {
  email: string;
  password: string;
  username: string;
  displayName: string;
}

export interface SignInDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// ─── API Responses ──────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─── Navigation ─────────────────────────────────────────────────────────────────

export type RootStackParamList = {
  '(auth)': undefined;
  '(tabs)': undefined;
};

export type AuthStackParamList = {
  login: undefined;
  register: undefined;
};

export type TabParamList = {
  index: undefined;      // Home / Feed
  explore: undefined;    // Explore / Discovery
  create: undefined;     // Create Post / Story
  inbox: undefined;      // Messages + Whispers
  communities: undefined;
  profile: undefined;
};

// ─── Notifications ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'follow'
  | 'follow_accept'
  | 'post_like'
  | 'post_comment'
  | 'comment_reply'
  | 'mention'
  | 'whisper'
  | 'whisper_reply'
  | 'message'
  | 'story_mention'
  | 'community'
  | 'system';

export interface NotificationActor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  actorId?: string | null;
  actor?: NotificationActor | null;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: 'post' | 'comment' | 'profile' | 'whisper' | 'chat' | 'community' | 'security' | null;
  entityId?: string | null;
  isRead: boolean;
  groupCount?: number;
  createdAt: string;
  updatedAt?: string;
}

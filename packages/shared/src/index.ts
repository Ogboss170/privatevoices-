// ─── User / Profile ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  phone?: string | null;
  isPhoneVerified?: boolean;
  isEmailVerified?: boolean;
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

export interface PollOption {
  id: string;
  pollId: string;
  optionText: string;
  optionOrder: number;
  voteCount: number;
}

export interface Poll {
  id: string;
  postId: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  myVoteOptionId?: string | null;
  hasVoted?: boolean;
}

export interface PostCommunity {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string | null;
  privacy?: 'public' | 'private';
}

export interface Post {
  id: string;
  authorId: string;
  author: PostAuthor;
  content: string;
  communityId?: string | null;
  community?: PostCommunity | null;
  imageUrls: string[];
  audioUrl?: string | null;
  audioDuration?: number | null;
  videoUrl?: string | null;
  hashtags: string[];
  likeCount: number;
  commentCount: number;
  repostCount: number;
  viewCount?: number;
  isLikedByMe: boolean;
  isSavedByMe: boolean;
  isRepostedByMe: boolean;
  poll?: Poll | null;
  isPinned?: boolean;
  pinnedAt?: string | null;
  pinnedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostDto {
  content: string;
  imageUrls?: string[];
  audioUrl?: string | null;
  audioDuration?: number | null;
  videoUrl?: string | null;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  author: PostAuthor;
  content: string;
  parentId?: string | null;
  replies?: Comment[];
  createdAt: string;
  likeCount?: number;
  isLikedByMe?: boolean;
}

export interface CreateCommentDto {
  postId: string;
  content: string;
  parentId?: string | null;
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
  | 'post_repost'
  | 'post_comment'
  | 'comment_reply'
  | 'mention'
  | 'whisper'
  | 'whisper_reply'
  | 'message'
  | 'story_mention'
  | 'community'
  | 'community_join'
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

// ─── Post Media Extraction Helper ──────────────────────────────────────────────

export function extractPostMediaAndCleanContent(
  rawContent: string,
  existingImageUrls: string[] = [],
  existingAudioUrl?: string | null,
  existingVideoUrl?: string | null
): { content: string; imageUrls: string[]; audioUrl?: string | null; videoUrl?: string | null } {
  if (!rawContent && (!existingImageUrls || existingImageUrls.length === 0)) {
    return { content: '', imageUrls: [], audioUrl: existingAudioUrl || null, videoUrl: existingVideoUrl || null };
  }

  const extractedUrls: string[] = [...(existingImageUrls || [])];
  let audioUrl: string | null = existingAudioUrl || null;
  let videoUrl: string | null = existingVideoUrl || null;

  // 1. Extract markdown image/media tags: ![alt](url)
  const markdownImgRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/gi;
  let cleanedContent = (rawContent || '').replace(markdownImgRegex, (_, url) => {
    if (url && !extractedUrls.includes(url)) {
      if (url.match(/\.(mp3|wav|ogg|m4a|aac|webm)(\?.*)?$/i)) {
        if (!audioUrl) audioUrl = url;
      } else if (url.match(/\.(mp4|mov|webm|quicktime)(\?.*)?$/i)) {
        if (!videoUrl) videoUrl = url;
      } else {
        extractedUrls.push(url);
      }
    }
    return '';
  });

  // 2. Extract standalone audio URLs
  const audioUrlRegex = /(https?:\/\/[^\s]+(?:\.(?:mp3|wav|ogg|m4a|aac|webm)|supabase\.co\/storage\/v1\/object\/public\/(?:chat-media|stories|post-media)\/[^\s]+\.(?:webm|mp3|wav|m4a))[^\s]*)/gi;
  cleanedContent = cleanedContent.replace(audioUrlRegex, (url) => {
    const cleanUrl = url.replace(/[.,;!?]+$/, '');
    if (!audioUrl) {
      audioUrl = cleanUrl;
      return '';
    }
    return url;
  });

  // 3. Extract standalone video URLs
  const videoUrlRegex = /(https?:\/\/[^\s]+(?:\.(?:mp4|mov|quicktime)|supabase\.co\/storage\/v1\/object\/public\/(?:chat-media|stories|post-media)\/[^\s]+\.(?:mp4|mov))[^\s]*)/gi;
  cleanedContent = cleanedContent.replace(videoUrlRegex, (url) => {
    const cleanUrl = url.replace(/[.,;!?]+$/, '');
    if (!videoUrl) {
      videoUrl = cleanUrl;
      return '';
    }
    return url;
  });

  // 4. Extract standalone image & GIF URLs (e.g. .gif, .png, .jpg, .jpeg, .webp, giphy, tenor, unsplash, supabase storage)
  const standaloneMediaUrlRegex = /(https?:\/\/[^\s]+(?:\.(?:png|jpg|jpeg|gif|webp)|giphy\.com|tenor\.com|unsplash\.com|supabase\.co\/storage\/v1\/object\/public\/post-media)[^\s]*)/gi;

  cleanedContent = cleanedContent.replace(standaloneMediaUrlRegex, (url) => {
    const cleanUrl = url.replace(/[.,;!?]+$/, '');
    if (cleanUrl && !extractedUrls.includes(cleanUrl)) {
      extractedUrls.push(cleanUrl);
    }
    return '';
  });

  // Clean up extra blank lines created by removal
  cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n').trim();

  return {
    content: cleanedContent,
    imageUrls: extractedUrls,
    audioUrl,
    videoUrl,
  };
}



// ─── Moderation & Safety Types ──────────────────────────────────────────────────

export type ModerationAction =
  | 'ALLOW'
  | 'ALLOW_AND_FLAG'
  | 'BLUR_RESTRICT'
  | 'HOLD_FOR_REVIEW'
  | 'BLOCK'
  | 'REMOVE'
  | 'RESTRICT_ACCOUNT'
  | 'SUSPEND_TEMPORARY'
  | 'BAN_PERMANENT';

export type ModerationRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ModerationCaseStatus = 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED' | 'APPEALED';

export type AppealStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

export interface CategoryScores {
  harassment?: number;
  hate?: number;
  threats?: number;
  violence?: number;
  sexual?: number;
  selfHarm?: number;
  spam?: number;
  fraud?: number;
  doxxing?: number;
  maliciousLinks?: number;
}

export interface ModerationEvaluation {
  action: ModerationAction;
  riskLevel: ModerationRiskLevel;
  categories: CategoryScores;
  reason: string;
  isSensitive?: boolean;
}

export interface ModerationCase {
  id: string;
  targetType: 'post' | 'comment' | 'reply' | 'whisper' | 'message' | 'story' | 'profile' | 'community';
  targetId: string;
  authorId?: string | null;
  reportedBy?: string | null;
  reason: string;
  details?: string | null;
  riskLevel: ModerationRiskLevel;
  status: ModerationCaseStatus;
  actionTaken: ModerationAction;
  categoryScores?: CategoryScores;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModerationAppeal {
  id: string;
  caseId: string;
  userId: string;
  explanation: string;
  status: AppealStatus;
  reviewerNotes?: string | null;
  reviewedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserSafetyScore {
  userId: string;
  safetyScore: number;
  strikeCount: number;
  reportsReceivedCount: number;
  spamViolationsCount: number;
  rateLimitHitsCount: number;
  isRestricted: boolean;
  restrictedUntil?: string | null;
}


// ─── Feed & Recommendation Types ────────────────────────────────────────────────

export type FeedMode = 'for-you' | 'following' | 'trending' | 'latest' | 'community';

export type FeedInteractionType =
  | 'VIEW_POST'
  | 'LIKE_POST'
  | 'COMMENT_POST'
  | 'REPOST_POST'
  | 'SAVE_POST'
  | 'SHARE_POST'
  | 'FOLLOW_USER'
  | 'OPEN_PROFILE'
  | 'OPEN_COMMUNITY'
  | 'JOIN_COMMUNITY'
  | 'FOLLOW_COMMUNITY'
  | 'HIDE_POST'
  | 'NOT_INTERESTED'
  | 'REPORT_POST'
  | 'BLOCK_USER'
  | 'MUTE_USER';

export interface FeedInteraction {
  id: string;
  userId: string;
  targetType: 'post' | 'user' | 'community';
  targetId: string;
  eventType: FeedInteractionType;
  weight: number;
  createdAt: string;
}

// ─── Gamification & XP System ──────────────────────────────────────────────────

export interface UserBadge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string;
}

export interface UserGamificationStats {
  userId: string;
  xp: number;
  level: number;
  levelTitle: string;
  nextLevelXp: number;
  progressPercent: number;
  badges: UserBadge[];
}

export function calculateUserGamification(xp: number, userBadges: UserBadge[] = []): UserGamificationStats {
  const safeXp = Math.max(0, xp || 0);

  // Level formula: Level = Math.floor(Math.sqrt(xp / 100)) + 1
  const level = Math.floor(Math.sqrt(safeXp / 100)) + 1;
  const currentLevelMinXp = Math.pow(level - 1, 2) * 100;
  const nextLevelXp = Math.pow(level, 2) * 100;
  
  const xpInCurrentLevel = safeXp - currentLevelMinXp;
  const xpNeededForNext = nextLevelXp - currentLevelMinXp;
  const progressPercent = Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNext) * 100));

  let levelTitle = 'Novice Voice';
  if (level >= 25) levelTitle = 'Grand Master Voice 👑';
  else if (level >= 20) levelTitle = 'Legendary Voice ⭐';
  else if (level >= 15) levelTitle = 'Master Speaker 💎';
  else if (level >= 10) levelTitle = 'Influential Voice 🔥';
  else if (level >= 5) levelTitle = 'Rising Speaker 🚀';
  else if (level >= 2) levelTitle = 'Active Contributor 🌱';

  return {
    userId: '',
    xp: safeXp,
    level,
    levelTitle,
    nextLevelXp,
    progressPercent,
    badges: userBadges,
  };
}

// ─── Appearance & Localization Settings ────────────────────────────────────────

export type ThemeMode = 'system' | 'light' | 'dark';

export * from './i18n';
import type { SupportedLanguage } from './i18n';

export interface AppearancePreferences {
  theme: ThemeMode;
  language: SupportedLanguage;
  reduceMotion: boolean;
  highContrast: boolean;
  compactMode: boolean;
}

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  theme: 'system',
  language: 'en',
  reduceMotion: false,
  highContrast: false,
  compactMode: false,
};

// ─── App Preview & Ratings Types ──────────────────────────────────────────────

export type PreviewFeatureStatus = 'coming_soon' | 'available_for_preview' | 'testing' | 'released';
export type PreviewFeatureCategory = 'core' | 'audio' | 'whispers' | 'community' | 'security' | 'reels' | 'premium' | 'livestream' | 'media';

export interface PreviewFeature {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: PreviewFeatureStatus;
  category: PreviewFeatureCategory;
  demoUrl?: string | null;
  badgeHighlight?: string | null;
  sortOrder: number;
  isActive: boolean;
  releasedAt?: string | null;
  createdAt: string;
}

export interface PreviewProgramTask {
  id: string;
  programId: string;
  title: string;
  description: string | null;
  taskType: 'feature_testing' | 'bug_hunt' | 'ux_feedback' | 'stress_test' | 'custom';
  sortOrder: number;
  isActive: boolean;
  isCompleted?: boolean;
  completedAt?: string | null;
}

export interface PreviewParticipantState {
  id: string;
  programId: string;
  userId: string;
  status: 'registered' | 'active' | 'eligible' | 'completed' | 'disqualified';
  tasksCompleted: number;
  validFeedbackCount: number;
  earlySupporterAwarded: boolean;
  betaTesterAwarded: boolean;
  registeredAt: string;
}

export interface AppRatingRecord {
  id: string;
  userId?: string | null;
  user_id?: string | null;
  rating: number; // 1 to 5
  review?: string | null;
  isAnonymous?: boolean;
  is_anonymous?: boolean;
  platform: 'web' | 'ios' | 'android';
  appVersion?: string;
  app_version?: string;
  status: 'published' | 'reviewed' | 'flagged' | 'hidden';
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  adminNotes?: string | null;
  admin_notes?: string | null;
}

export interface AppRatingSummary {
  totalReviews: number;
  total_count?: number;
  averageRating: number;
  average_rating?: number;
  distribution: {
    '1': number;
    '2': number;
    '3': number;
    '4': number;
    '5': number;
    [key: number]: number;
  };
}

// ─── Direct Message Calling Types (Audio & Video) ────────────────────────────

export type DMCallType = 'audio' | 'video';

export type DMCallStatus =
  | 'idle'
  | 'outgoing_ringing'
  | 'incoming_ringing'
  | 'connecting'
  | 'connected'
  | 'declined'
  | 'missed'
  | 'ended'
  | 'busy';

export interface DMCallParticipant {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface DMCallSession {
  callId: string;
  conversationId: string;
  type: DMCallType;
  status: DMCallStatus;
  caller: DMCallParticipant;
  receiver: DMCallParticipant;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number;
  isMuted?: boolean;
  isCameraOff?: boolean;
  isSpeakerOn?: boolean;
  cameraFacing?: 'user' | 'environment';
}

export interface DMCallSignalPayload {
  callId: string;
  conversationId: string;
  type: DMCallType;
  action: 'call_init' | 'call_accept' | 'call_decline' | 'call_end' | 'ice_candidate' | 'sdp_offer' | 'sdp_answer';
  caller: DMCallParticipant;
  receiver: DMCallParticipant;
  sdp?: any;
  candidate?: any;
  timestamp: number;
}

// ─── Group Direct Messaging Types ─────────────────────────────────────────────

export interface GroupMember {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'admin' | 'member';
  joinedAt: string;
}

export interface GroupConversation {
  id: string;
  isGroup: boolean;
  title: string | null;
  avatarUrl: string | null;
  createdBy: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  members: GroupMember[];
  memberCount?: number;
}

// ─── Live Audio Spaces & Group Voice Lounges ──────────────────────────────────

export type SpaceRole = 'host' | 'speaker' | 'listener';
export type SpaceStatus = 'live' | 'ended';

export interface SpaceParticipant {
  id: string;
  spaceId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: SpaceRole;
  handRaised: boolean;
  isMuted: boolean;
  joinedAt: string;
}

export interface LiveSpace {
  id: string;
  title: string;
  topic?: string | null;
  hostId: string;
  host?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  communityId?: string | null;
  status: SpaceStatus;
  speakerCount: number;
  listenerCount: number;
  createdAt: string;
  endedAt?: string | null;
  participants?: SpaceParticipant[];
}

export interface SpacePollOption {
  id: string;
  pollId: string;
  optionText: string;
  voteCount: number;
}

export interface SpacePoll {
  id: string;
  spaceId: string;
  question: string;
  createdBy: string;
  status: 'active' | 'ended';
  createdAt: string;
  options: SpacePollOption[];
  userVotedOptionId?: string | null;
  totalVotes?: number;
}

export interface FloatingSpaceReaction {
  id: string;
  emoji: string;
  userId: string;
  xOffset: number;
  createdAt: number;
}





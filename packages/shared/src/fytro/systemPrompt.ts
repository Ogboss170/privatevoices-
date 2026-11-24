/**
 * Fytro Core Persona & System Instructions
 * ============================================================
 * Fytro is an independent AI companion built for Private Voices.
 * 
 * "Your Mind Space. Think freely. Explore deeply. Discover more."
 */

export const FYTRO_SYSTEM_PROMPT = `You are Fytro, an intelligent, empathetic, and intellectually rigorous AI companion created for Private Voices.

### YOUR PHILOSOPHY & FOUNDATION
You exist to encourage curiosity, independent thinking, authentic self-expression, clarity, and truth. You provide both intellectual depth and deep personal presence.

### CORE DIRECTIVES
1. **Direct, Straight-to-the-Point Answers**:
   - Always go straight to the answer.
   - For greetings (e.g. "hi", "hello", "hey"), respond warmly and naturally right away (e.g. "Hello! How can I help you today?"). Never echo the greeting back with reflective prompts or rhetorical questions like "Reflecting on what you shared...".
   - When the user asks a factual question, technical question, math problem, historical query, or general explanation, ALWAYS provide a completely accurate, direct, and factually correct answer immediately without preamble or evasive philosophical framing.
   - Never evade questions with vague poetic deflections, forced therapy-speak, or unsolicited rhetorical inquiries.

2. **Intellectual Depth & Independent Thought**:
   - When the user explicitly seeks feedback on dilemmas, life decisions, creative projects, or philosophy, provide thoughtful nuance, consider alternative perspectives (steel-manning counterarguments), and help the user clarify their own thoughts.
   - Encourage curiosity and critical thinking without lecturing, scolding, or preaching. Treat the user as a sovereign adult.

3. **Grounded, Articulate, and Concise**:
   - Avoid robotic cliches ("As an AI...", "I hope this finds you well").
   - Answer directly first; only add brief helpful elaboration if relevant.
   - Use clean, readable markdown formatting, code blocks, or bullet points when structured explanation helps.

4. **Privacy & Anonymity Guardian**:
   - You take user privacy seriously. If a user shares a personal draft for public posting on Private Voices, proactively notice identifying markers (uncommon titles, full names, locations) and suggest safe generalizations.
`;

export type FytroMode = 'sanctuary' | 'challenger' | 'creative' | 'shield';

export const FYTRO_MODE_INSTRUCTIONS: Record<FytroMode, string> = {
  sanctuary: `\n[Active Mode: Sanctuary]
Provide empathetic, thoughtful, and accurate conversation. While maintaining warmth, always answer factual and informative queries clearly and directly.`,

  challenger: `\n[Active Mode: Challenger]
Critically test assumptions, explore blind spots, and present the strongest counter-arguments, while ensuring all factual reasoning and claims remain strictly accurate.`,

  creative: `\n[Active Mode: Creative Catalyst]
Help brainstorm original ideas, vivid writing, and novel angles while keeping logic and facts sound.`,

  shield: `\n[Active Mode: Anonymity Shield]
Scrutinize text for identifying details or de-anonymization risks and provide clear suggestions to preserve anonymity.`,
};

export type FytroMemoryCategory = 'perspective' | 'value' | 'dilemma' | 'goal' | 'context';

export interface FytroMemory {
  id: string;
  userId: string;
  category: FytroMemoryCategory;
  memoryText: string;
  importance: number;
  createdAt: string;
  updatedAt: string;
}

export type FytroReaction = 'like' | 'dislike';

export type FytroFeedbackReason =
  | 'inaccurate'
  | 'not_helpful'
  | 'repetitive'
  | 'hallucination'
  | 'harmful_or_unsafe'
  | 'out_of_character'
  | 'other';

export interface FytroFeedback {
  id: string;
  messageId: string;
  sessionId?: string | null;
  userId: string;
  reaction: FytroReaction;
  reasons?: FytroFeedbackReason[];
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FytroReport {
  id: string;
  messageId: string;
  sessionId?: string | null;
  userId: string;
  reason: string;
  details?: string | null;
  createdAt: string;
}

export type FytroVoiceId = 'serene' | 'nova' | 'echo' | 'onyx' | 'aura';

export interface FytroVoiceOption {
  id: FytroVoiceId;
  name: string;
  gender: 'female' | 'male' | 'neutral';
  tone: string;
  description: string;
  rate: number;
  pitch: number;
  preferredVoices: string[];
}

export const FYTRO_VOICE_OPTIONS: FytroVoiceOption[] = [
  {
    id: 'serene',
    name: 'Serene (Default)',
    gender: 'female',
    tone: 'Calm, gentle & reflective',
    description: 'A soothing, warm, articulate voice ideal for sanctuary & reflection.',
    rate: 0.95,
    pitch: 1.0,
    preferredVoices: ['Samantha', 'Google US English', 'Natural', 'Karen', 'Victoria'],
  },
  {
    id: 'nova',
    name: 'Nova',
    gender: 'female',
    tone: 'Dynamic, clear & confident',
    description: 'A sharp, forward-leaning tone well-suited for brainstorming & quick insights.',
    rate: 1.05,
    pitch: 1.15,
    preferredVoices: ['Zira', 'Microsoft Zira', 'Google UK English Female', 'Tessa', 'Moira'],
  },
  {
    id: 'echo',
    name: 'Echo',
    gender: 'male',
    tone: 'Deep, steady & grounded',
    description: 'A resonant, measured voice for intellectual challenge and philosophical inquiry.',
    rate: 0.92,
    pitch: 0.85,
    preferredVoices: ['Daniel', 'Microsoft David', 'Google UK English Male', 'Oliver', 'Arthur'],
  },
  {
    id: 'onyx',
    name: 'Onyx',
    gender: 'male',
    tone: 'Crisp, articulate & direct',
    description: 'A direct, analytical, focused delivery for facts, logic, and rapid answers.',
    rate: 1.0,
    pitch: 0.95,
    preferredVoices: ['Alex', 'Microsoft Mark', 'Tom', 'Fred', 'Aaron'],
  },
  {
    id: 'aura',
    name: 'Aura',
    gender: 'neutral',
    tone: 'Ethereal, rhythmic & mindful',
    description: 'A spacious, neutral presence for deep contemplation and unhurried thoughts.',
    rate: 0.88,
    pitch: 1.05,
    preferredVoices: ['Fiona', 'Veena', 'Google English', 'Serena'],
  },
];




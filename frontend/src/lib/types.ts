export interface VideoPackage {
  id: string;
  topic?: string;
  sections?: PackageSection[];
  approval?: ApprovalResult;
  reference_used?: boolean;
  reference_url?: string;
  created_at?: string;
}

export interface PackageSection {
  id?: string;
  agent?: string;
  section_type: string;
  content: unknown;
  score: number;
}

export interface ApprovalResult {
  status: string;
  scores: Record<string, number>;
  failing: { category: string; score: number; required: number }[];
  corrections: string[];
}

export interface ReferenceAnalysis {
  video_id: string;
  title: string;
  channel_name: string;
  thumbnail_url?: string;
  transcript?: string;
  style_profile?: StyleProfile;
}

export interface StyleProfile {
  visual_style?: string;
  editing_style?: string;
  tone?: string;
  music_preferences?: string;
  pacing?: string;
  content_patterns?: Record<string, any>;
  hooks?: string;
  thumbnails_style?: string;
  score?: Record<string, any>;
}

export interface ChannelProfile {
  name: string;
  niche: string;
  audience: string;
  language: string;
}

export interface ProviderKeys {
  gemini?: string;
  groq?: string;
  cerebras?: string;
  deepseek?: string;
  openai?: string;
}

export interface YoutubeTokens {
  refresh_token: string;
  access_token?: string;
  expires_at?: number;
}

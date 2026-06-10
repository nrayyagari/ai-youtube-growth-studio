export interface VideoPackage {
  id: string;
  channel_id?: string;
  sections?: PackageSection[];
  approval?: ApprovalResult;
  reference_used?: boolean;
  reference_url?: string;
  created_at?: string;
}

export interface PackageSection {
  id?: number;
  section_type: string;
  content: string;
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

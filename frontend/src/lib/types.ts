export interface Channel {
  id: number;
  name: string;
  niche: string;
  audience: string;
  target_country: string;
  language: string;
  content_mode: string;
  monetization_goal: string;
  upload_frequency: string;
  banned_topics: string;
  created_at: string;
  packages?: VideoPackage[];
}

export interface Workflow {
  id: number;
  name: string;
  description: string;
  script_format: string;
  scene_format: string;
  visual_style: string;
  music_style: string;
  qa_checklist: string[];
  scoring_rules: Record<string, any>;
  skills: Skill[];
}

export interface Skill {
  id: number;
  name: string;
  category: string;
  description: string;
}

export interface VideoPackage {
  id: number;
  channel_id: number;
  workflow_id: number;
  status: string;
  created_at: string;
  sections?: PackageSection[];
  growth_scores?: GrowthScore[];
  qa_reports?: QAReport[];
  approval?: ApprovalResult;
}

export interface PackageSection {
  id: number;
  package_id: number;
  section_type: string;
  content: string;
  score: number;
}

export interface GrowthScore {
  id: number;
  package_id: number;
  category: string;
  score: number;
  explanation: string;
}

export interface QAReport {
  id: number;
  package_id: number;
  check_type: string;
  score: number;
  status: string;
  details: string;
}

export interface ApprovalResult {
  status: string;
  scores: Record<string, number>;
  failing: { category: string; score: number; required: number }[];
  corrections: string[];
}

export interface ReferenceVideo {
  id: number;
  channel_id: number;
  url: string;
  video_id: string;
  title: string;
  channel_name: string;
  thumbnail_url: string;
  duration: string;
  transcript: string;
  created_at: string;
}

export interface StyleProfile {
  id: number;
  channel_id: number;
  name: string;
  visual_style: string;
  editing_style: string;
  tone: string;
  music_preferences: string;
  pacing: string;
  content_patterns: Record<string, any>;
  hooks: string;
  thumbnails_style: string;
  raw_analysis: Record<string, any>;
  created_at: string;
}

export interface CalendarEntry {
  id: number;
  channel_id: number;
  package_id: number | null;
  scheduled_date: string;
  status: string;
  slot_name: string;
  notes: string;
  package_status?: string;
  created_at: string;
}

export interface PublishingSlot {
  id: number;
  channel_id: number;
  day_of_week: number;
  hour: number;
  label: string;
  enabled: number;
}

export interface BatchResult {
  generated: number;
  results: { package_id: number; topic: string; status: string }[];
}

export interface AnalyticsSnapshot {
  id: number;
  channel_id: number;
  snapshot_date: string;
  views: number;
  watch_time_minutes: number;
  subscribers: number;
  avg_ctr: number;
  avg_retention: number;
  top_videos: string;
  demographics: string;
}

export interface UserState {
  id: string;
  email: string;
  subscription_tier: string;
  usage: {
    tier: string;
    channels: { used: number; limit: number | null };
    packages_this_month: { used: number; limit: number | null };
    features: Record<string, boolean>;
  };
}

export interface PaymentProvider {
  id: string;
  name: string;
  regions: string[];
  methods?: string[];
}

export interface Recommendation {
  id: number;
  channel_id: number;
  recommendation_type: string;
  title: string;
  description: string;
  priority: number;
  based_on: string;
  created_at: string;
}

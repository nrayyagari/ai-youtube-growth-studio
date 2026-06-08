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

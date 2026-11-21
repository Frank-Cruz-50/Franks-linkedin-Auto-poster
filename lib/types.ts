// Shared shapes for the client and server. They mirror seed/seed.json.

export type Tag = "headline" | "evergreen";
export type PostStatus = "idea" | "planned" | "draft" | "scheduled" | "posted";
export type VersionKey = "safe_straight" | "safe_funny" | "contra_straight" | "contra_funny";
export type Provider = "claude" | "gemini";

export interface Photo {
  id: string;
  own?: boolean;
  url?: string;
  file?: string;
  thumb?: string;
  regular?: string;
  alt?: string;
  author?: string;
  authorUrl?: string;
  pageUrl?: string;
  downloadLocation?: string;
  query?: string;
  assetId?: string;
}

export interface Batch {
  id: string;
  createdAt: string;
  note: string;
  mix: { headline: number; evergreen: number } | null;
}

export interface Article {
  id: string;
  batchId: string;
  createdAt: string;
  tag: Tag;
  topic: string;
  title: string;
  source: string;
  date: string;
  url: string;
  summary: string;
  stats: string[];
  why: string;
  extra?: string | null;
  trendScore?: number | null;
  trendWhy?: string | null;
  trendSource?: string | null;
  trendCheckedAt?: string | null;
  photos?: Photo[] | null;
}

export interface Trend {
  id: string;
  checkedAt: string;
  source: string;
  topics: { topic: string; heat?: number | null; why?: string }[];
  formats: { format: string; note?: string }[];
}

export interface Angle {
  title: string;
  take: string;
  story: "news" | "picture-this" | string;
  why?: string;
  model?: string;
}

export interface Version {
  key: VersionKey | string;
  hooks: string[];
  body: string;
  model?: string;
}

export interface Post {
  id: string;
  articleId?: string | null;
  articleTitle: string;
  articleUrl: string;
  source: string;
  topic: string;
  tag: string;
  createdAt: string;
  status: PostStatus | string;
  angle?: Angle | null;
  versions?: Version[] | null;
  photo?: string | null;
  carousel?: { h: string; t: string }[] | null;
  long?: { title: string; body: string; model?: string } | null;
  finalText?: string | null;
  chosenVersion?: string | null;
  chosenHook?: number | null;
  suggestedAtPick?: string | null;
  pickedAt?: string | null;
  scheduledFor?: string | null;
  typefullyId?: string | null;
  photoPick?: Photo | null;
  photoAttached?: boolean | null;
  impressions?: number | null;
  followersGained?: number | null;
  autopilot?: boolean;
  draftId?: string | null;
}

export interface Draft {
  id: string;
  text: string;
  learn: boolean;
  status: "banked" | "scheduled" | string;
  version?: string | null;
  hook?: number | null;
  articleId?: string | null;
  articleTitle: string;
  articleUrl: string;
  source: string;
  topic: string;
  tag: string;
  suggestedAtPick?: string | null;
  postId?: string | null;
  typefullyId?: string | null;
  scheduledFor?: string | null;
  photo?: Photo | null;
  createdAt: string;
  updatedAt: string;
}

export interface Playbook {
  voice: string;
  structure: string;
  guardrails: string;
  hooks: string;
  loves: string;
  banned: string;
  research: string;
  updatedAt?: string;
}

export interface Settings {
  autoResearch: boolean;
  autopilot: boolean;
  ready85: boolean;
  ready85At?: string | null;
  followers?: number | null;
  followersAt?: string | null;
  searchRequestedAt?: string | null;
  searchHandledAt?: string | null;
  searchExclude: string[];
}

export interface JobRun {
  id: string;
  kind: string;
  trigger: string;
  provider?: string | null;
  model?: string | null;
  status: "running" | "ok" | "error" | "limit" | string;
  progress: string;
  error?: string | null;
  limitResetsAt?: string | null;
  turns?: number | null;
  durationMs?: number | null;
  startedAt: string;
  finishedAt?: string | null;
}

export interface AppState {
  articles: Article[];
  batches: Batch[];
  trends: Trend[];
  posts: Post[];
  drafts: Draft[];
  playbook: Playbook;
  settings: Settings;
  research: JobRun | null;
  claudeLimit: { resetsAt: string | null } | null;
  aiPrimary: Provider;
  apiKeyBlocked: boolean;
  config: { typefully: boolean; unsplash: boolean; socialSetId: string; tz: string };
}

export const PB_FIELDS: [keyof Playbook, string][] = [
  ["voice", "Voice"],
  ["structure", "Post structure"],
  ["guardrails", "Guardrails"],
  ["hooks", "Hook rules"],
  ["loves", "Words you love"],
  ["banned", "Banned words and phrases"],
  ["research", "Research rules"],
];

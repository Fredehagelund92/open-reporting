/**
 * Shared TypeScript interfaces for the Open Reporting frontend.
 */

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  avatar: string
  joinedAt: string
  provider: string
  is_active: boolean
}

export interface AuthProviderInfo {
  provider: string
  display_name: string
}

export interface Space {
  id: string
  name: string
  description?: string
  is_private: boolean
  owner_id?: string
  created_at?: string
  report_count?: number
  member_count?: number
}

export interface SpaceStats {
  total_spaces: number
  total_reports: number
  total_memberships: number
}

export interface Agent {
  id: string
  name: string
  description?: string | null
  status?: string
  report_count?: number
  owner_name?: string | null
  is_active?: boolean
  is_claimed?: boolean
  api_key?: string
  api_key_hint?: string
  created_at?: string
  last_published_at?: string | null
  chat_enabled?: boolean
}

export interface Report {
  id: string
  title: string
  summary?: string
  html_body?: string
  slug?: string | null
  content_type: "report" | "slideshow"
  agent_id: string
  agent_name: string
  agent?: string
  space_id?: string
  space_name: string
  space?: string
  tags: string[]
  created_at: string
  updated_at?: string
  user_vote?: number
  upvote_score?: number
  upvotes?: number
  comment_count?: number
  run_number?: number
  can_delete?: boolean
  series_id?: string | null
  series_total?: number | null
  prev_slug?: string | null
  next_slug?: string | null
  time?: string
  chat_enabled?: boolean
}

export interface Reaction {
  emoji: string
  count: number
  reacted: boolean
}

export interface ReportComment {
  id: string
  author_name: string
  author_avatar?: string
  author?: { name: string; avatar?: string }
  text: string
  quoted_text?: string | null
  created_at: string
  reactions: Reaction[]
}

export interface Subscription {
  id: string
  targetType: string
  targetId: string
  label: string
}

export interface Favorite {
  id: string
  targetType: string
  targetId: string
  label: string
}

export interface AppNotification {
  id: string
  text: string
  link: string
  is_read: boolean
  created_at: string
}

export interface AgentAnalyticsSummary {
  total_reports: number
  total_upvotes: number
  total_downvotes: number
  net_score: number
  avg_score: number
  total_comments: number
  total_reactions: number
  engagement_rate: number
  first_report_at: string | null
  last_report_at: string | null
}

export interface TimeBucket {
  period_start: string
  report_count: number
  total_score: number
  avg_score: number
  comment_count: number
  reaction_count: number
}

export interface TopEngagedReport {
  id: string
  title: string
  slug: string
  created_at: string
  upvote_score: number
  comment_count: number
  engagement_score: number
}

export interface AgentAnalytics {
  summary: AgentAnalyticsSummary
  time_series: TimeBucket[]
  top_reports: TopEngagedReport[]
}

// --- Agent Chat Protocol v1 ---

export interface ChatMessage {
  role: "user" | "agent"
  content: string
}

export interface AgentChatResult {
  reply: string
  format: "markdown" | "plain"
  conversation_id: string
  metadata?: {
    sources?: string[]
    confidence?: number
    usage?: {
      questions_used: number
      questions_limit: number | null
      reset_at?: string
    }
    [key: string]: unknown
  }
}

export interface EvidenceMeta {
  source: string | null
  confidence: 'HIGH' | 'MED' | 'LOW' | null
  grounding_score: number | null
}

export interface Gate1Conflict {
  type: 'interaction' | 'contraindication' | 'allergy' | 'dose'
  detail: string
  severity: 'high' | 'moderate' | 'low'
  source: string
}

export interface Gate1Trace {
  verdict: string
  conflicts: Gate1Conflict[]
  checked: {
    interactions: boolean
    contraindications: boolean
    dose: boolean
    allergy: boolean
  }
}

export interface CriticalInfo {
  medications: string[];
  allergies: string[];
  conditions: string[];
  flags: string[];
  blood_group: string | null;
  age: number;
  caregiver: string;
}

export interface ResponseAction {
  type: string
  label: string
  target: string | null
  pending_id?: string
}

export type VerdictType =
  | 'SAFE' | 'CAUTION' | 'UNSAFE' | 'INFO'
  | 'EMERGENCY' | 'REFUSE' | 'CONFIRMED' | 'CANCELLED' | 'CLARIFY' | null

export interface ReportData {
  title: string
  markdown: string
  report_type: string
  generated_at: string
}

export interface ResponseEnvelope {
  verdict: VerdictType
  spoken: string
  display: {
    title: string
    conflict: string | null
    alternative: string | null
    detail: string
    member: string | null
    interpreted: string | null
    members?: string[]  // multi-node pattern alerts
    urgency?: 'Emergency' | 'Urgent' | 'Moderate' | 'Low' | null
    critical?: CriticalInfo
    report_markdown?: string
  }
  evidence: EvidenceMeta
  actions: ResponseAction[]
  member_focus: string | null
  language: 'bn' | 'en'
  intent?: string
  needs_confirmation?: boolean
  pending_id?: string
  household_refresh?: boolean
  gate1_trace?: Gate1Trace
  radar_alert?: {
    verdict: string
    conflict: string | null
    detail: string
    source: string | null
    gate1_trace?: Gate1Trace
  }
}

export type RiskBand = 'LOW' | 'MED' | 'HIGH'

export interface InsightItem {
  id: string
  severity: 'HIGH' | 'MED' | 'LOW'
  category: 'interaction' | 'contraindication' | 'allergy' | 'dose' | 'flag' | 'poly'
  title: string
  detail: string
  member: string
  action_query: string
}

export interface MedicationInfo {
  name: string
  dose: string
}

export interface ReminderInfo {
  id: number
  medication_id: number | null
  time: string
  repeat_rule: string
  active: boolean
}

export interface AllergyInfo {
  substance: string
  reaction: string | null
}

export interface MemberFlags {
  kidney_impaired: boolean
  liver_impaired: boolean
  pregnant: boolean
}

export interface HouseholdMember {
  id: number
  display_name: string
  role_label: string
  age: number
  sex: string
  weight_kg: number | null
  conditions: string[]
  medications: MedicationInfo[]
  allergies: AllergyInfo[]
  kidney_impaired: boolean
  liver_impaired: boolean
  pregnant: boolean
  reminders: ReminderInfo[]
}

export interface Household {
  id: number
  name: string
  members: HouseholdMember[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  envelope?: ResponseEnvelope
  timestamp: number
}

export interface HealthEvent {
  id: number;
  member_id: number;
  event_type: string;
  detail: any;
  created_at: string;
}

export interface MemberTwinData {
  member: string;
  age: number;
  sex: string;
  risk_score: number;
  risk_band: 'LOW' | 'MED' | 'HIGH';
  risk_factors: string[];
  ai_summary: string;
  medications: string[];
  conditions: string[];
  allergies: string[];
  flags: string[];
  caregiver: string | null;
  reminders: any[];
  recent_alerts: any[];
}

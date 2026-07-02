export interface EvidenceMeta {
  source: string | null
  confidence: 'HIGH' | 'MED' | 'LOW' | null
  grounding_score: number | null
}

export interface ResponseAction {
  type: string
  label: string
  target: string | null
  pending_id?: string
}

export type VerdictType =
  | 'SAFE' | 'CAUTION' | 'UNSAFE' | 'INFO'
  | 'EMERGENCY' | 'REFUSE' | 'CONFIRMED' | 'CANCELLED' | null

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
  }
  evidence: EvidenceMeta
  actions: ResponseAction[]
  member_focus: string | null
  language: 'bn' | 'en'
  intent?: string
  needs_confirmation?: boolean
  pending_id?: string
  household_refresh?: boolean
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
  role_label: string
  age: number
  sex: string
  weight_kg: number | null
  conditions: string[]
  medications: MedicationInfo[]
  allergies: AllergyInfo[]
  flags: MemberFlags
  reminders: ReminderInfo[]
}

export interface Household {
  id: number
  name: string
  members: HouseholdMember[]
}

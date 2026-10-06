export type SmsChannel = 'VERIFY' | 'BULK'

export interface SmsTemplate {
  event: string
  label: string
  description: string
  channel: SmsChannel
  enabled: boolean
  /** Free text, for BULK events. Null for VERIFY — that wording lives in SMS.ir's panel. */
  body: string | null
  providerTemplateId: number | null
  /** The `{{placeholders}}` this event is allowed to use. */
  variables: string[]
  preview: string | null
  /**
   * Why this event cannot currently send, if it cannot. Shown next to the
   * switch so the admin is never told a notification is on when nothing can
   * reach the customer.
   */
  blockedReason: string | null
}

export interface SmsTemplateListResponse {
  templates: SmsTemplate[]
}

export interface SmsTemplateResponse {
  template: SmsTemplate
}

export interface SmsTemplateUpdateBody {
  enabled?: boolean
  body?: string
  providerTemplateId?: number | null
}

export interface SmsAccountStatus {
  configured: boolean
  lineNumber: string | null
  credit: number | null
  lines: number[] | null
  error: string | null
}

export interface SmsTestResult {
  outcome: string
  reason?: string
  messageId?: number | null
}

export interface SmsLogRow {
  id: string
  phone: string
  message: string
  event: string | null
  status: 'PENDING' | 'SENT' | 'FAILED'
  sentAt: string | null
  createdAt: string
  reason: string | null
}

export interface SmsLogResponse {
  rows: SmsLogRow[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

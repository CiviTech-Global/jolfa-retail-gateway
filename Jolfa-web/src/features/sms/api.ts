import { apiRequest } from '@/api/client'
import type {
  SmsAccountStatus,
  SmsLogResponse,
  SmsTemplateListResponse,
  SmsTemplateResponse,
  SmsTemplateUpdateBody,
  SmsTestResult,
} from './types'

export function getSmsTemplates(): Promise<SmsTemplateListResponse> {
  return apiRequest<SmsTemplateListResponse>('/admin/sms/templates')
}

export function updateSmsTemplate(
  event: string,
  body: SmsTemplateUpdateBody,
): Promise<SmsTemplateResponse> {
  return apiRequest<SmsTemplateResponse>(`/admin/sms/templates/${encodeURIComponent(event)}`, {
    method: 'PATCH',
    body,
  })
}

/** Sends one real message and spends real credit. */
export function sendTestSms(event: string, phone: string): Promise<SmsTestResult> {
  return apiRequest<SmsTestResult>('/admin/sms/test', {
    method: 'POST',
    body: { event, phone },
  })
}

export function getSmsStatus(): Promise<SmsAccountStatus> {
  return apiRequest<SmsAccountStatus>('/admin/sms/status')
}

export function getSmsLog(params: {
  page: number
  limit: number
  event?: string
  status?: string
}): Promise<SmsLogResponse> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
    ...(params.event ? { event: params.event } : {}),
    ...(params.status ? { status: params.status } : {}),
  })
  return apiRequest<SmsLogResponse>(`/admin/sms/log?${query.toString()}`)
}

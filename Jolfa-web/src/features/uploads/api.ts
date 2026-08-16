import { apiRequest } from '@/api/client'

export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiRequest<{ url: string }>('/uploads', {
    method: 'POST',
    body: formData,
  })

  return response.url
}

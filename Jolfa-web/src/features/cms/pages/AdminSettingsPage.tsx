import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getAdminSettings, updateAdminSetting } from '../api'
import type { SettingDto } from '../types'

function isBooleanValue(value: string): boolean {
  return ['true', 'false'].includes(value.toLowerCase())
}

function SettingRow({ setting }: { setting: SettingDto }) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState(setting.value)

  const mutation = useMutation({
    mutationFn: () => updateAdminSetting(setting.key, { value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
    },
  })

  const hasChanged = value !== setting.value

  return (
    <tr>
      <td className="px-4 py-3 font-medium text-foreground">{setting.key}</td>
      <td className="px-4 py-3 text-gray-500">{setting.group}</td>
      <td className="px-4 py-3 text-gray-500">{setting.description ?? '-'}</td>
      <td className="px-4 py-3">
        {isBooleanValue(setting.value) ? (
          <select
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="true">فعال</option>
            <option value="false">غیرفعال</option>
          </select>
        ) : (
          <Input value={value} onChange={(event) => setValue(event.target.value)} className="w-full" />
        )}
      </td>
      <td className="px-4 py-3">
        <Button size="sm" disabled={!hasChanged} loading={mutation.isPending} onClick={() => mutation.mutate()}>
          ذخیره
        </Button>
      </td>
    </tr>
  )
}

export function AdminSettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: getAdminSettings,
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">تنظیمات</h1>
      <p className="mt-2 text-gray-600">مقدار هر تنظیم را تغییر داده و ذخیره کنید.</p>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-background">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted text-foreground">
              <tr>
                <th className="px-4 py-3 text-right">کلید</th>
                <th className="px-4 py-3 text-right">گروه</th>
                <th className="px-4 py-3 text-right">توضیحات</th>
                <th className="px-4 py-3 text-right">مقدار</th>
                <th className="px-4 py-3 text-right">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    در حال بارگذاری ...
                  </td>
                </tr>
              ) : (
                data?.map((setting) => <SettingRow key={setting.id} setting={setting} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

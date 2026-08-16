import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Card } from '@/components/ui/Card'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { getAdminSettings, updateAdminSetting } from '../api'
import type { SettingDto } from '../types'

function isBooleanValue(value: string): boolean {
  return ['true', 'false'].includes(value.toLowerCase())
}

function SettingCard({ setting }: { setting: SettingDto }) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState(setting.value)

  const mutation = useMutation({
    mutationFn: (nextValue: string) => updateAdminSetting(setting.key, { value: nextValue }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      void queryClient.invalidateQueries({ queryKey: ['settings', 'public'] })
    },
  })

  const hasChanged = value !== setting.value
  const booleanMode = isBooleanValue(setting.value)

  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{setting.key}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {setting.description ?? setting.group}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {booleanMode ? (
          <Switch
            checked={value === 'true'}
            onCheckedChange={(checked) => {
              const nextValue = checked ? 'true' : 'false'
              setValue(nextValue)
              mutation.mutate(nextValue)
            }}
          />
        ) : (
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="w-48"
          />
        )}
        {!booleanMode && (
          <Button size="sm" disabled={!hasChanged} loading={mutation.isPending} onClick={() => mutation.mutate(value)}>
            <Save className="h-4 w-4" />
            <span className="sr-only">ذخیره</span>
          </Button>
        )}
      </div>
    </Card>
  )
}

export function AdminSettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: getAdminSettings,
  })

  return (
    <ScrollReveal className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">تنظیمات</h1>
        <p className="mt-2 text-muted-foreground">مقدار هر تنظیم را تغییر داده و ذخیره کنید.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {data?.settings.map((setting) => <SettingCard key={setting.id} setting={setting} />)}
        </div>
      )}
    </ScrollReveal>
  )
}

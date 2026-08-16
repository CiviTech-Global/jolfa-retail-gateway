import { useCallback, useState } from 'react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { ReactNode } from 'react'

interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'primary'
}

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({ title: '' })
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null)
  const [loading, setLoading] = useState(false)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts)
    setIsOpen(true)
    setLoading(false)
    return new Promise((resolve) => {
      setResolver(() => resolve)
    })
  }, [])

  const handleConfirm = useCallback(async () => {
    setLoading(true)
    resolver?.(true)
    setIsOpen(false)
    setLoading(false)
  }, [resolver])

  const handleCancel = useCallback(() => {
    resolver?.(false)
    setIsOpen(false)
  }, [resolver])

  const Dialog = useCallback(
    () => (
      <ConfirmDialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) handleCancel()
        }}
        title={options.title}
        description={options.description}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        variant={options.variant}
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    [isOpen, options, loading, handleConfirm, handleCancel]
  )

  return { confirm, Dialog }
}

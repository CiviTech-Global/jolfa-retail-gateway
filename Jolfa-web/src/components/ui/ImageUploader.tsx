import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ImagePlus, RefreshCw, Star, Trash2, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ACCEPT_ATTRIBUTE,
  MAX_UPLOAD_BYTES,
  uploadFile,
  validateImageFile,
} from '@/features/uploads/api'

const faNumber = new Intl.NumberFormat('fa-IR')

export interface UploadedImage {
  url: string
  altText?: string
  sortOrder?: number
  isPrimary?: boolean
}

/** A file in flight — local only, never part of the submitted form value. */
interface PendingUpload {
  id: string
  file: File
  previewUrl: string
  progress: number
  status: 'uploading' | 'error'
  error?: string
}

export interface ImageUploaderProps {
  value: UploadedImage[]
  onChange: (images: UploadedImage[]) => void
  maxFiles?: number
  disabled?: boolean
  error?: string
  /** Alt text applied to newly uploaded images. */
  altTextFallback?: string
}

export function ImageUploader({
  value,
  onChange,
  maxFiles = 10,
  disabled = false,
  error,
  altTextFallback,
}: ImageUploaderProps) {
  const [pending, setPending] = useState<PendingUpload[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [rejected, setRejected] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)

  // Object URLs are per-render resources; releasing them on unmount keeps the
  // blobs from being pinned in memory for the life of the page.
  const previewUrls = useRef(new Set<string>())
  useEffect(() => {
    const urls = previewUrls.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  // Several files upload in parallel and each completion appends one image.
  // Closing over `value` would make every handler append to its own stale
  // snapshot, so all but the last result would be dropped. Latest-value refs
  // keep the appends serialisable without re-creating the upload callbacks.
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    valueRef.current = value
    onChangeRef.current = onChange
  })

  const remainingSlots = maxFiles - value.length - pending.length

  const startUpload = useCallback(
    (file: File, id: string, previewUrl: string) => {
      void uploadFile(file, {
        onProgress: (percent) => {
          setPending((prev) =>
            prev.map((item) => (item.id === id ? { ...item, progress: percent } : item)),
          )
        },
      })
        .then((uploaded) => {
          setPending((prev) => prev.filter((item) => item.id !== id))
          URL.revokeObjectURL(previewUrl)
          previewUrls.current.delete(previewUrl)

          const current = valueRef.current
          const next = [
            ...current,
            {
              url: uploaded.url,
              altText: altTextFallback,
              sortOrder: current.length,
              isPrimary: current.length === 0,
            },
          ]
          valueRef.current = next
          onChangeRef.current(next)
        })
        .catch((err: unknown) => {
          setPending((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    status: 'error',
                    error: err instanceof Error ? err.message : 'آپلود ناموفق بود',
                  }
                : item,
            ),
          )
        })
    },
    [altTextFallback],
  )

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      if (disabled) return
      const incoming = Array.from(files)
      const problems: string[] = []
      const accepted: File[] = []

      for (const file of incoming) {
        const validationError = validateImageFile(file)
        if (validationError) {
          problems.push(`${file.name}: ${validationError}`)
        } else if (accepted.length >= remainingSlots) {
          problems.push(`${file.name}: حداکثر ${faNumber.format(maxFiles)} تصویر مجاز است`)
        } else {
          accepted.push(file)
        }
      }

      setRejected(problems)

      const created = accepted.map((file) => {
        const previewUrl = URL.createObjectURL(file)
        previewUrls.current.add(previewUrl)
        return {
          id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
          file,
          previewUrl,
          progress: 0,
          status: 'uploading' as const,
        }
      })

      if (created.length > 0) {
        setPending((prev) => [...prev, ...created])
        created.forEach((item) => startUpload(item.file, item.id, item.previewUrl))
      }
    },
    [disabled, maxFiles, remainingSlots, startUpload],
  )

  const retry = (item: PendingUpload) => {
    setPending((prev) =>
      prev.map((entry) =>
        entry.id === item.id ? { ...entry, status: 'uploading', progress: 0, error: undefined } : entry,
      ),
    )
    startUpload(item.file, item.id, item.previewUrl)
  }

  const dismiss = (item: PendingUpload) => {
    URL.revokeObjectURL(item.previewUrl)
    previewUrls.current.delete(item.previewUrl)
    setPending((prev) => prev.filter((entry) => entry.id !== item.id))
  }

  const removeImage = (index: number) => {
    const next = value.filter((_, i) => i !== index)
    if (next.length > 0 && !next.some((img) => img.isPrimary)) {
      next[0] = { ...next[0], isPrimary: true }
    }
    onChange(next.map((img, i) => ({ ...img, sortOrder: i })))
  }

  const setPrimary = (index: number) => {
    onChange(value.map((img, i) => ({ ...img, isPrimary: i === index })))
  }

  return (
    <div className="space-y-3">
      <div
        onDragEnter={(event) => {
          event.preventDefault()
          dragDepth.current += 1
          setIsDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault()
          dragDepth.current -= 1
          if (dragDepth.current <= 0) {
            dragDepth.current = 0
            setIsDragging(false)
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          dragDepth.current = 0
          setIsDragging(false)
          if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files)
        }}
        className={cn(
          'relative overflow-hidden rounded-2xl border-2 border-dashed p-4 transition-colors',
          isDragging ? 'border-primary bg-primary-soft/40' : 'border-border bg-surface',
          error && 'border-danger',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        {/* Light sweep that only runs while a drag is hovering. */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              className="pointer-events-none absolute inset-0 bg-gradient-to-l from-transparent via-primary/10 to-transparent"
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: '100%', opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </AnimatePresence>

        <div className="relative flex flex-wrap gap-3">
          <AnimatePresence mode="popLayout">
            {value.map((image, index) => (
              <motion.div
                key={image.url}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                className="group relative h-28 w-28 overflow-hidden rounded-xl border border-border bg-muted"
              >
                <img
                  src={image.url}
                  alt={image.altText || `تصویر ${faNumber.format(index + 1)}`}
                  className="h-full w-full object-cover"
                />

                {image.isPrimary && (
                  <span className="absolute top-1 start-1 rounded-md bg-warning px-1.5 py-0.5 text-[10px] font-medium text-white shadow">
                    اصلی
                  </span>
                )}

                <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => setPrimary(index)}
                    title="تصویر اصلی"
                    className="rounded-md bg-white/90 p-1 text-primary transition-transform hover:scale-110"
                  >
                    <Star className={cn('h-3.5 w-3.5', image.isPrimary && 'fill-current')} />
                    <span className="sr-only">انتخاب به عنوان تصویر اصلی</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    title="حذف تصویر"
                    className="rounded-md bg-white/90 p-1 text-danger transition-transform hover:scale-110"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">حذف تصویر</span>
                  </button>
                </div>
              </motion.div>
            ))}

            {pending.map((item) => (
              <UploadTile key={item.id} item={item} onRetry={() => retry(item)} onDismiss={() => dismiss(item)} />
            ))}
          </AnimatePresence>

          {remainingSlots > 0 && (
            <motion.button
              type="button"
              layout
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => inputRef.current?.click()}
              className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-background text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <ImagePlus className="h-6 w-6" />
              <span className="text-xs font-medium">افزودن تصویر</span>
              <span className="text-[10px]">{faNumber.format(remainingSlots)} جای خالی</span>
            </motion.button>
          )}
        </div>

        <p className="relative mt-3 text-xs text-muted-foreground">
          تصاویر را بکشید و اینجا رها کنید — JPG، PNG، WebP یا GIF، حداکثر{' '}
          {faNumber.format(Math.round(MAX_UPLOAD_BYTES / (1024 * 1024)))} مگابایت.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files)
            // Reset so re-picking the same file fires a change event.
            event.target.value = ''
          }}
        />
      </div>

      <AnimatePresence>
        {rejected.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1 overflow-hidden"
          >
            {rejected.map((message) => (
              <li key={message} className="flex items-start gap-1.5 text-xs text-danger">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{message}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * One in-flight file. The thumbnail is revealed from the bottom up in step with
 * real byte progress, with a progress ring over it — so the animation reports
 * the transfer rather than decorating it.
 */
function UploadTile({
  item,
  onRetry,
  onDismiss,
}: {
  item: PendingUpload
  onRetry: () => void
  onDismiss: () => void
}) {
  const isError = item.status === 'error'
  const radius = 20
  const circumference = 2 * Math.PI * radius

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="relative h-28 w-28 overflow-hidden rounded-xl border border-border bg-muted"
    >
      <img src={item.previewUrl} alt="" aria-hidden="true" className="h-full w-full object-cover" />

      {/* Desaturated veil that retreats downward as the upload completes. */}
      <motion.div
        className="absolute inset-x-0 top-0 backdrop-blur-[2px] backdrop-grayscale"
        initial={{ height: '100%' }}
        animate={{ height: isError ? '100%' : `${100 - item.progress}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 24 }}
        style={{ backgroundColor: 'rgb(0 0 0 / 0.35)' }}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        {isError ? (
          <>
            <TriangleAlert className="h-6 w-6 text-white drop-shadow" />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onRetry}
                title="تلاش دوباره"
                className="rounded-md bg-white/90 p-1 text-primary transition-transform hover:scale-110"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="sr-only">تلاش دوباره</span>
              </button>
              <button
                type="button"
                onClick={onDismiss}
                title="حذف"
                className="rounded-md bg-white/90 p-1 text-danger transition-transform hover:scale-110"
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">حذف</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
              <circle
                cx="24"
                cy="24"
                r={radius}
                fill="none"
                strokeWidth="3.5"
                className="stroke-white/25"
              />
              <motion.circle
                cx="24"
                cy="24"
                r={radius}
                fill="none"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="stroke-white"
                style={{ strokeDasharray: circumference }}
                animate={{ strokeDashoffset: circumference * (1 - item.progress / 100) }}
                transition={{ type: 'spring', stiffness: 120, damping: 24 }}
              />
            </svg>
            <span className="text-xs font-semibold tabular-nums text-white drop-shadow">
              {item.progress >= 100 ? (
                <Check className="h-4 w-4" />
              ) : (
                `${faNumber.format(item.progress)}٪`
              )}
            </span>
          </>
        )}
      </div>

      {isError && item.error && (
        <p className="absolute inset-x-0 bottom-0 bg-danger/90 px-1 py-0.5 text-center text-[10px] leading-tight text-white">
          {item.error}
        </p>
      )}
    </motion.div>
  )
}

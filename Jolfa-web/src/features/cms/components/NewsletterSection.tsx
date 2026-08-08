import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface NewsletterSectionProps {
  config: Record<string, unknown>
}

export function NewsletterSection({ config }: NewsletterSectionProps) {
  const title = (config.title as string | undefined) ?? 'از تخفیف‌ها جا نمانید'
  const description =
    (config.description as string | undefined) ??
    'ایمیل خود را وارد کنید تا از جدیدترین پیشنهادها مطلع شوید.'
  const buttonText = (config.buttonText as string | undefined) ?? 'عضویت'

  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!email) return
    setSubmitted(true)
    setEmail('')
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <div className="rounded-2xl bg-muted p-8 text-center md:p-12">
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <p className="mx-auto mt-2 max-w-xl text-gray-600">{description}</p>
        {submitted ? (
          <p className="mt-6 font-medium text-primary">با تشکر! شما در خبرنامه عضو شدید.</p>
        ) : (
          <form onSubmit={handleSubmit} className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="flex-1"
              required
            />
            <Button type="submit">{buttonText}</Button>
          </form>
        )}
      </div>
    </section>
  )
}

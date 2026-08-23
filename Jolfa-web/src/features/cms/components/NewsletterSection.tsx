import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { toast } from 'sonner'
import { requiredEmailSchema } from '@/lib/validation'

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
  const [error, setError] = useState<string>()
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const result = requiredEmailSchema.safeParse(email)
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'ایمیل معتبر نیست')
      return
    }
    setError(undefined)
    setSubmitted(true)
    setEmail('')
    toast.success('با تشکر! شما در خبرنامه عضو شدید.')
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 md:py-14">
      <ScrollReveal direction="up">
        <div className="relative overflow-hidden rounded-2xl bg-primary p-8 text-center text-primary-foreground md:p-12">
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-2xl font-bold">{title}</h2>
            <p className="mx-auto mt-2 max-w-xl opacity-90">{description}</p>
            {submitted ? (
              <p className="mt-6 font-medium">با تشکر! شما در خبرنامه عضو شدید.</p>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="mx-auto mt-6 max-w-md">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    type="email"
                    dir="ltr"
                    placeholder="your@email.com"
                    value={email}
                    aria-label="ایمیل"
                    aria-invalid={Boolean(error)}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      if (error) setError(undefined)
                    }}
                    className="flex-1 border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/60 focus-visible:ring-primary-foreground/30"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                  >
                    {buttonText}
                  </Button>
                </div>
                {error && (
                  <p role="alert" className="mt-2 text-start text-sm text-primary-foreground">
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </ScrollReveal>
    </section>
  )
}

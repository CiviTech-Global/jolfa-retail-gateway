import { Card, CardContent } from '@/components/ui/Card'
import { Seo } from '@/components/seo/Seo'

interface UserPlaceholderPageProps {
  title: string
}

export function UserPlaceholderPage({ title }: UserPlaceholderPageProps) {
  return (
    <div className="max-w-3xl">
      <Seo title={title} />
      <Card className="py-16 text-center">
        <CardContent>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          <p className="mt-2 text-muted-foreground">این بخش به زودی فعال می‌شود.</p>
        </CardContent>
      </Card>
    </div>
  )
}

import { Sun, Moon } from 'lucide-react'
import { Button } from './Button'
import { useTheme } from '@/providers/theme-provider'

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={resolvedTheme === 'dark' ? 'روشن کردن تم' : 'تاریک کردن تم'}
      onClick={toggleTheme}
      className={className}
    >
      {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  )
}

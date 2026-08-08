export function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-foreground">تماس با ما</h1>
      <p className="mt-6 leading-7 text-gray-600">
        برای پشتیبانی، پیشنهادات و شکایات می‌توانید از طریق راه‌های ارتباطی زیر با ما در تماس باشید:
      </p>
      <ul className="mt-4 list-inside list-disc space-y-2 text-gray-600">
        <li>تلفن: ۰۴۱-۳۵۵۵۵۵۵۵</li>
        <li>ایمیل: support@jolfa.local</li>
        <li>آدرس: منطقه آزاد جلفا، بازارچه مرزی جلفا</li>
      </ul>
      <p className="mt-4 text-gray-600">
        ساعات پاسخگویی: شنبه تا چهارشنبه از ۹ صبح تا ۶ بعدازظهر
      </p>
    </div>
  )
}

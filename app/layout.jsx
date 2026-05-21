import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata = {
  title: 'ezcalendar',
  description: 'Pin flyers to dates. AI fills in the details.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[#080808] text-white antialiased font-[var(--font-inter)]">{children}</body>
    </html>
  )
}

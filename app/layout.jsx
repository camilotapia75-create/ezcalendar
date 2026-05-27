import { Inter, Caveat } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const caveat = Caveat({ subsets: ['latin'], variable: '--font-caveat', display: 'swap' })

export const viewport = {
  themeColor: '#0c0c0e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export const metadata = {
  title: 'ezcalendar',
  description: 'Snap a flyer. It lands on the right date.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ezcalendar',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${caveat.variable}`}>
      <body className="bg-[#0c0c0e] text-white antialiased font-[var(--font-inter)]">
        {children}
      </body>
    </html>
  )
}

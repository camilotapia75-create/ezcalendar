import './globals.css'

export const metadata = {
  title: 'ezcalendar',
  description: 'Pin flyers to dates. AI fills in the details.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white">{children}</body>
    </html>
  )
}

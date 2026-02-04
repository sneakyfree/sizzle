import type { Metadata } from 'next'
import '../src/styles/globals.css'

export const metadata: Metadata = {
  title: 'Sizzle - Beast-Mode GPU Compute by the Minute',
  description: 'The most normie-friendly GPU compute platform in the world. Rent H100s, B300s, and more - no terminal required.',
  keywords: ['GPU', 'AI', 'machine learning', 'compute', 'cloud', 'NVIDIA'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  )
}

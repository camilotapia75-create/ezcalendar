import { ImageResponse } from 'next/og'
import { createElement as h } from 'react'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// FLYRLY calendar mark for the iOS home-screen icon.
export default function AppleIcon() {
  return new ImageResponse(
    h('div', {
      style: { width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0b' },
    },
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
        h('div', { style: { display: 'flex', gap: 16, marginBottom: -5, zIndex: 1 } },
          h('div', { style: { width: 18, height: 18, borderRadius: 9, background: '#c6f24e' } }),
          h('div', { style: { width: 18, height: 18, borderRadius: 9, background: '#c6f24e' } }),
        ),
        h('div', {
          style: { width: 116, height: 108, borderRadius: 22, background: '#c6f24e', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        },
          h('span', { style: { color: '#0a0a0b', fontSize: 60, fontWeight: 900, fontFamily: 'system-ui, sans-serif', letterSpacing: '-2px' } }, '20'),
        ),
      ),
    ),
    { width: 180, height: 180 }
  )
}

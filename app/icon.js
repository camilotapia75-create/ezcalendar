import { ImageResponse } from 'next/og'
import { createElement as h } from 'react'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

// FLYRLY calendar mark: lime body with "20", two binding posts on top.
export default function Icon() {
  return new ImageResponse(
    h('div', {
      style: { width: 512, height: 512, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0b' },
    },
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
        h('div', { style: { display: 'flex', gap: 44, marginBottom: -14, zIndex: 1 } },
          h('div', { style: { width: 50, height: 50, borderRadius: 25, background: '#c6f24e' } }),
          h('div', { style: { width: 50, height: 50, borderRadius: 25, background: '#c6f24e' } }),
        ),
        h('div', {
          style: { width: 320, height: 300, borderRadius: 60, background: '#c6f24e', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        },
          h('span', { style: { color: '#0a0a0b', fontSize: 168, fontWeight: 900, fontFamily: 'system-ui, sans-serif', letterSpacing: '-6px' } }, '20'),
        ),
      ),
    ),
    { width: 512, height: 512 }
  )
}

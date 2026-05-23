import { ImageResponse } from 'next/og'
import { createElement } from 'react'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    createElement(
      'div',
      {
        style: {
          width: 180,
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
        },
      },
      createElement(
        'span',
        {
          style: {
            color: 'white',
            fontSize: '76px',
            fontWeight: '900',
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '-0.04em',
            marginTop: '4px',
          },
        },
        'ez'
      )
    ),
    { width: 180, height: 180 }
  )
}

import { ImageResponse } from 'next/og'
import { createElement } from 'react'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    createElement(
      'div',
      {
        style: {
          width: 512,
          height: 512,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
          borderRadius: '96px',
        },
      },
      createElement(
        'span',
        {
          style: {
            color: 'white',
            fontSize: '210px',
            fontWeight: '900',
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '-0.04em',
            marginTop: '8px',
          },
        },
        'ez'
      )
    ),
    { width: 512, height: 512 }
  )
}

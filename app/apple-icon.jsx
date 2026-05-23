import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
      }}
    >
      <span
        style={{
          color: 'white',
          fontSize: '76px',
          fontWeight: '900',
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: '-0.04em',
          marginTop: '4px',
        }}
      >
        ez
      </span>
    </div>,
    { width: 180, height: 180 }
  )
}

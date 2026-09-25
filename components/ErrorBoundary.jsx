'use client'
import React from 'react'

// Catches render/runtime errors in the tab content so one bad render can't white
// out the whole app (which iOS then reports as "a problem repeatedly occurred").
// Shows the actual error so it can be diagnosed instead of vanishing.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    try { console.error('[ezcal] render error:', error, info?.componentStack) } catch {}
  }
  render() {
    if (this.state.error) {
      const msg = String(this.state.error?.stack || this.state.error?.message || this.state.error)
      return (
        <div style={{ padding: '32px 20px', maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '8px 0 6px' }}>That view hit a snag</p>
          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 16px' }}>The rest of the app is fine — screenshot this and send it over:</p>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11, color: 'var(--text-3)', textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', padding: 12, borderRadius: 12, overflow: 'auto', maxHeight: 260, margin: '0 0 16px' }}>{msg}</pre>
          <button onClick={() => this.setState({ error: null })} className="btn-lime" style={{ padding: '12px 24px', fontSize: 15, cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthForm from '@/components/AuthForm'

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/calendar')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#0c0c0e' }}>
      <div className="w-full max-w-xs">
        <div className="text-center mb-10">
          <div
            className="w-16 h-16 rounded-[20px] flex items-center justify-center text-lg font-black mx-auto mb-6"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 8px 32px rgba(124,58,237,0.4)' }}
          >ez</div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">ezcalendar</h1>
          <p className="text-sm text-white/30">Snap a flyer. It lands on the right date.</p>
        </div>
        <AuthForm />
      </div>
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthForm from '@/components/AuthForm'

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/calendar')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">📅</div>
          <h1 className="text-3xl font-bold mb-2">ezcalendar</h1>
          <p className="text-gray-400 text-sm">Pin flyers to dates. AI reads them for you.</p>
        </div>
        <AuthForm />
      </div>
    </div>
  )
}

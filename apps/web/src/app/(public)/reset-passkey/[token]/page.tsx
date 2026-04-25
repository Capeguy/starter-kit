import { ResetPasskeyClient } from './_components/reset-passkey-client'

interface ResetRouteProps {
  params: Promise<{ token: string }>
}

export default async function ResetPasskeyRoute({ params }: ResetRouteProps) {
  const { token } = await params

  return (
    <main className="container mx-auto flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <ResetPasskeyClient token={token} />
    </main>
  )
}

import { InviteClient } from './_components/invite-client'

interface InviteRouteProps {
  params: Promise<{ token: string }>
}

export default async function InviteRoute({ params }: InviteRouteProps) {
  const { token } = await params

  return (
    <main className="container mx-auto flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <InviteClient token={token} />
    </main>
  )
}

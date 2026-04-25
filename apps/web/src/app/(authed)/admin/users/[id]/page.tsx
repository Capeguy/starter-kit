import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { UserDetailPage } from './_components/user-detail-page'

export default async function AdminUserDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await prefetch(trpc.admin.users.get.queryOptions({ userId: id }))

  return (
    <HydrateClient>
      <UserDetailPage userId={id} />
    </HydrateClient>
  )
}

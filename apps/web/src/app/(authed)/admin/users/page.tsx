import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { UsersListPage } from './_components/users-list-page'

export default async function AdminUsersRoute() {
  await prefetch(trpc.admin.users.list.queryOptions({ limit: 50 }))

  return (
    <HydrateClient>
      <UsersListPage />
    </HydrateClient>
  )
}

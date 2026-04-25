import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { RolesListPage } from './_components/roles-list-page'

export default async function AdminRolesRoute() {
  await prefetch(trpc.admin.roles.list.queryOptions())

  return (
    <HydrateClient>
      <RolesListPage />
    </HydrateClient>
  )
}

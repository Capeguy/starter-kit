import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { SystemMessagePage } from './_components/system-message-page'

export default async function SystemMessageRoute() {
  await prefetch(trpc.systemMessage.get.queryOptions())
  return (
    <HydrateClient>
      <SystemMessagePage />
    </HydrateClient>
  )
}

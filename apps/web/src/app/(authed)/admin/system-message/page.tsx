import { SystemMessagePage } from './_components/system-message-page'

import { HydrateClient, prefetch, trpc } from '~/trpc/server'

export default async function SystemMessageRoute() {
  await prefetch(trpc.systemMessage.get.queryOptions())
  return (
    <HydrateClient>
      <SystemMessagePage />
    </HydrateClient>
  )
}

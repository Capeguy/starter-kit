import { MyFilesPage } from './_components/my-files-page'

import { HydrateClient, prefetch, trpc } from '~/trpc/server'

export default async function MyFilesRoute() {
  await prefetch(trpc.file.listMine.queryOptions({ limit: 50 }))

  return (
    <HydrateClient>
      <MyFilesPage />
    </HydrateClient>
  )
}

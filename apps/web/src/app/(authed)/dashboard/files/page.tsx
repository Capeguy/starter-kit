import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { MyFilesPage } from './_components/my-files-page'

export default async function MyFilesRoute() {
  await prefetch(trpc.file.listMine.queryOptions({ limit: 50 }))

  return (
    <HydrateClient>
      <MyFilesPage />
    </HydrateClient>
  )
}

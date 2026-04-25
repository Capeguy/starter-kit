import z from 'zod'

import { deleteFile, listMyFiles } from '~/server/modules/file/file.service'
import { createTRPCRouter, protectedProcedure } from '../trpc'

export const fileRouter = createTRPCRouter({
  listMine: protectedProcedure
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(({ input, ctx }) =>
      listMyFiles({
        userId: ctx.user.id,
        cursor: input.cursor,
        limit: input.limit,
      }),
    ),

  delete: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .mutation(({ input, ctx }) =>
      deleteFile({
        fileId: input.fileId,
        actingUserId: ctx.user.id,
        actingUserRole: ctx.user.role,
      }),
    ),
})

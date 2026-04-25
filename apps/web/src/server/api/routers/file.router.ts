import z from 'zod'

import {
  deleteFile,
  listMyFiles,
  searchMyFiles,
} from '~/server/modules/file/file.service'
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

  search: protectedProcedure
    .input(
      z.object({
        query: z.string().max(200),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(({ input, ctx }) =>
      searchMyFiles({
        userId: ctx.user.id,
        query: input.query,
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

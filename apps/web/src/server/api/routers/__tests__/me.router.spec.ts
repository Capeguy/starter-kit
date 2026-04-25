import { TRPCError } from '@trpc/server'
import { resetTables } from '~tests/db/utils'
import { createTestCaller, createTestContext } from '~tests/trpc'

import { db } from '@acme/db'

describe('meRouter', () => {
  beforeEach(async () => {
    await resetTables(['User', 'Account'])
  })

  describe('get', () => {
    it('should throw UNAUTHORIZED error when user is not authenticated', async () => {
      const ctx = createTestContext(undefined)
      const caller = createTestCaller(ctx)

      try {
        await caller.me.get()
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toEqual('UNAUTHORIZED')
      }
    })

    it('should return user data (incl. role and avatarUrl) when authenticated', async () => {
      const testUser = await db.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
        },
      })

      const ctx = createTestContext({ session: { userId: testUser.id } })
      const caller = createTestCaller(ctx)
      const result = await caller.me.get()

      expect(result).toMatchObject({
        id: testUser.id,
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        avatarUrl: null,
        role: 'USER',
      })
      expect(result?.createdAt).toBeInstanceOf(Date)
    })

    it('should throw UNAUTHORIZED when authenticated user does not exist in database (orphan session)', async () => {
      // authMiddleware loads the user from DB to source role; an orphan
      // session points at a deleted/nonexistent user and must be rejected.
      const ctx = createTestContext({
        session: { userId: 'non-existent-user-id' },
      })
      const caller = createTestCaller(ctx)

      try {
        await caller.me.get()
        throw new Error('expected throw')
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toEqual('UNAUTHORIZED')
      }
    })

    it('should return correct user when multiple users exist', async () => {
      const user1 = await db.user.create({
        data: { email: 'user1@example.com', name: 'User One' },
      })
      const user2 = await db.user.create({
        data: { email: 'user2@example.com', name: 'User Two' },
      })

      const ctx = createTestContext({ session: { userId: user2.id } })
      const caller = createTestCaller(ctx)
      const result = await caller.me.get()

      expect(result?.id).toBe(user2.id)
      expect(result?.email).toBe('user2@example.com')
      expect(result?.id).not.toBe(user1.id)
    })

    it('should default new user role to USER', async () => {
      const u = await db.user.create({ data: { name: 'Defaulter' } })
      const ctx = createTestContext({ session: { userId: u.id } })
      const caller = createTestCaller(ctx)
      const result = await caller.me.get()
      expect(result?.role).toBe('USER')
    })
  })
})

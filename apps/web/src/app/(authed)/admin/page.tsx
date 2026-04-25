import NextLink from 'next/link'

import { db } from '@acme/db'

const StatTile = ({
  label,
  value,
}: {
  label: string
  value: string | number
}) => (
  <div className="border-base-divide-medium flex flex-col gap-1 rounded-md border p-4">
    <span className="prose-label-sm text-base-content-medium">{label}</span>
    <span className="prose-h3 text-base-content-strong">{value}</span>
  </div>
)

async function loadStats() {
  // Compute timestamps inside the data loader, not the render body
  // (React Compiler flags `new Date()` in component bodies as impure).
  const now = Date.now()
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)

  const [userCount, recentSignIns, audit24h, fileCount] = await Promise.all([
    db.user.count(),
    db.auditLog.count({
      where: {
        action: 'auth.passkey.authenticate',
        createdAt: { gte: weekAgo },
      },
    }),
    db.auditLog.count({ where: { createdAt: { gte: dayAgo } } }),
    db.file.count(),
  ])

  return { userCount, recentSignIns, audit24h, fileCount }
}

export default async function AdminLandingPage() {
  const stats = await loadStats()

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="prose-h2 text-base-content-strong">Admin</h1>
        <p className="prose-body-2 text-base-content-medium">
          Operational view of the system.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Total users" value={stats.userCount} />
        <StatTile label="Sign-ins (7d)" value={stats.recentSignIns} />
        <StatTile label="Audit events (24h)" value={stats.audit24h} />
        <StatTile label="Files stored" value={stats.fileCount} />
      </div>

      <nav aria-label="Admin sections" className="flex flex-col gap-2">
        <NextLink
          href="/admin/users"
          className="prose-body-1 text-base-content-brand hover:underline"
        >
          → User management
        </NextLink>
        <NextLink
          href="/admin/audit"
          className="prose-body-1 text-base-content-brand hover:underline"
        >
          → Audit log
        </NextLink>
        <NextLink
          href="/admin/notifications"
          className="prose-body-1 text-base-content-brand hover:underline"
        >
          → Send notification
        </NextLink>
        <NextLink
          href="/admin/files"
          className="prose-body-1 text-base-content-brand hover:underline"
        >
          → All files
        </NextLink>
      </nav>
    </div>
  )
}

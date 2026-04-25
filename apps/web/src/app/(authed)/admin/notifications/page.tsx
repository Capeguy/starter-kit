import { BroadcastForm } from './_components/broadcast-form'

export default function AdminNotificationsRoute() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="prose-h2 text-base-content-strong">
          Broadcast notification
        </h1>
        <p className="prose-body-2 text-base-content-medium">
          Send an in-app notification to all users, all admins, or a single
          user.
        </p>
      </header>
      <BroadcastForm />
    </div>
  )
}

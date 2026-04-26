'use client'

import { Card, CardBody, CardHeader } from '~/components/ui/card'
import { ApiTokensSection } from './api-tokens-section'

export const SettingsPage = () => {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="prose-h2 text-base-content-strong">Settings</h1>
        <p className="prose-body-2 text-base-content-medium">
          Manage your account and personal API tokens.
        </p>
      </header>

      <Card>
        <CardHeader title="Personal API tokens" />
        <CardBody>
          <ApiTokensSection />
        </CardBody>
      </Card>
    </div>
  )
}

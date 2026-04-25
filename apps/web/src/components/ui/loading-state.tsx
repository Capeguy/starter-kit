import { Spinner } from '@opengovsg/oui/spinner'

export interface LoadingStateProps {
  label?: string
}

export const LoadingState = ({ label = 'Loading…' }: LoadingStateProps) => {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10">
      <Spinner />
      <p className="prose-body-2 text-base-content-medium">{label}</p>
    </div>
  )
}

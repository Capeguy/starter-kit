import { Loader2 } from 'lucide-react'

export interface LoadingStateProps {
  label?: string
}

export const LoadingState = ({ label = 'Loading…' }: LoadingStateProps) => {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10">
      <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  )
}

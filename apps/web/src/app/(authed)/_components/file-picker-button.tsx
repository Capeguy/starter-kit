'use client'

import { useId, useRef, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'

import { Button } from '~/components/ui/button'

interface FilePickerButtonProps {
  label?: string
  accept?: string
  isPending?: boolean
  onFileSelected: (file: File) => void
}

/**
 * Wraps a hidden native file input with a styled Button trigger so the
 * user sees a proper control instead of the bare browser widget. The
 * picked filename is shown next to the button as a hint.
 */
export const FilePickerButton = ({
  label = 'Choose file',
  accept,
  isPending,
  onFileSelected,
}: FilePickerButtonProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const inputId = useId()
  const [filename, setFilename] = useState<string>()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            setFilename(f.name)
            onFileSelected(f)
          }
          // Clear value so picking the same file twice still fires onChange.
          e.target.value = ''
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Upload aria-hidden />
        )}
        {label}
      </Button>
      {filename && (
        <span className="text-muted-foreground truncate text-xs">
          {filename}
        </span>
      )}
    </div>
  )
}

'use client'

import { useId, useRef, useState } from 'react'
import { Button } from '@opengovsg/oui/button'
import { BiUpload } from 'react-icons/bi'

interface FilePickerButtonProps {
  label?: string
  accept?: string
  isPending?: boolean
  onFileSelected: (file: File) => void
}

/**
 * Wraps a hidden native file input with an OUI Button trigger so the user
 * sees a proper styled control instead of the bare browser widget.
 * The picked filename is shown next to the button as a hint.
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
        size="sm"
        variant="outline"
        startContent={<BiUpload className="h-4 w-4" />}
        isPending={isPending}
        onPress={() => inputRef.current?.click()}
      >
        {label}
      </Button>
      {filename && (
        <span className="prose-caption-2 text-base-content-medium truncate">
          {filename}
        </span>
      )}
    </div>
  )
}

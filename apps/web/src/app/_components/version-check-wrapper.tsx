'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { REQUIRE_UPDATE_EVENT } from '~/constants'

interface VersionModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

const VersionModal = ({ isOpen, onOpenChange }: VersionModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update available</DialogTitle>
          <DialogDescription>
            A new version of this app is available. Please refresh the page to
            get the latest version.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              window.location.reload()
            }}
          >
            Refresh
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Contains the version check banner and modal that will be shown when the
 * client receives a `REQUIRE_UPDATE_EVENT` event.
 */
export const VersionCheckWrapper = () => {
  const [requireUpdate, setRequireUpdate] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const handleRequireUpdateEvent = useCallback(() => {
    setRequireUpdate(true)
    setIsOpen(true)
  }, [])

  useEffect(() => {
    window.addEventListener(REQUIRE_UPDATE_EVENT, handleRequireUpdateEvent)

    return () => {
      window.removeEventListener(REQUIRE_UPDATE_EVENT, handleRequireUpdateEvent)
    }
  }, [handleRequireUpdateEvent])

  return (
    <>
      {requireUpdate && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-100"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>An update is available. Please refresh the page.</span>
        </div>
      )}
      <VersionModal isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  )
}

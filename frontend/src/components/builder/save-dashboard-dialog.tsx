import { useEffect, useState } from 'react'

import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface SaveDashboardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultName: string
  defaultDescription: string
  onSave: (name: string, description: string) => void
  isSaving: boolean
}

export function SaveDashboardDialog({
  open,
  onOpenChange,
  defaultName,
  defaultDescription,
  onSave,
  isSaving,
}: SaveDashboardDialogProps) {
  const [name, setName] = useState(`Copy of ${defaultName}`)
  const [description, setDescription] = useState(defaultDescription)

  useEffect(() => {
    if (open) {
      setName(`Copy of ${defaultName}`)
      setDescription(defaultDescription)
    }
  }, [open, defaultName, defaultDescription])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save Dashboard As</DialogTitle>
        </DialogHeader>
        <div>
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dashboard name"
            className="mt-1"
          />
        </div>
        <div className="mt-3">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Dashboard description (optional)"
            className="mt-1"
            rows={3}
          />
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Discard
          </Button>
          <Button
            onClick={() => onSave(name, description)}
            disabled={!name.trim() || isSaving}
          >
            {isSaving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Save Dashboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useDatabases } from '@/hooks/use-databases'
import { useCreateDataset } from '@/hooks/use-managed-datasets'
import { autoDetectColumns } from '@/lib/column-detection'

interface SaveAsDatasetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sql: string
  databaseId: number | null
  columns: string[]
  rows: Record<string, unknown>[]
}

export function SaveAsDatasetDialog({
  open,
  onOpenChange,
  sql,
  databaseId,
  columns,
  rows,
}: SaveAsDatasetDialogProps) {
  const navigate = useNavigate()
  const { data: databases = [] } = useDatabases()
  const createDataset = useCreateDataset()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedDbId, setSelectedDbId] = useState<string>('')

  // Reset form and pre-populate database when dialog opens
  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setSelectedDbId(databaseId ? String(databaseId) : '')
    }
  }, [open, databaseId])

  const handleSave = () => {
    const dbId = Number(selectedDbId)
    if (!name.trim() || !dbId) return

    const detectedColumns = autoDetectColumns(columns, rows)

    createDataset.mutate(
      {
        name: name.trim(),
        description: description.trim(),
        databaseId: dbId,
        sql,
        columns: detectedColumns,
      },
      {
        onSuccess: (dataset) => {
          onOpenChange(false)
          toast.success(`Dataset "${name.trim()}" created`, {
            action: {
              label: 'Edit',
              onClick: () =>
                navigate({
                  to: '/datasets/$datasetId/edit',
                  params: { datasetId: dataset.id },
                }),
            },
          })
        },
      },
    )
  }

  const canSave = name.trim().length > 0 && selectedDbId !== ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save as Dataset</DialogTitle>
          <DialogDescription>
            Save your query results as a reusable dataset for dashboard charts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="dataset-name">Name</Label>
            <Input
              id="dataset-name"
              placeholder="e.g. Breaks by Desk"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataset-description">Description</Label>
            <Textarea
              id="dataset-description"
              placeholder="Optional description..."
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataset-database">Database</Label>
            <Select value={selectedDbId} onValueChange={setSelectedDbId}>
              <SelectTrigger id="dataset-database" className="text-sm">
                <SelectValue placeholder="Select database" />
              </SelectTrigger>
              <SelectContent>
                {databases.map((db) => (
                  <SelectItem key={db.id} value={String(db.id)}>
                    {db.databaseName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            {columns.length} columns detected. Column metadata will be
            auto-detected. Refine in the dataset editor after saving.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Never mind
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave || createDataset.isPending}
          >
            {createDataset.isPending ? 'Saving...' : 'Save Dataset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

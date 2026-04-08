import { Share2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/**
 * Share button for the dashboard view-mode toolbar.
 *
 * Copies `window.location.href` (which already encodes the current filter
 * state via the URL sync effect on the view route) to the clipboard and
 * surfaces success/failure via Sonner toasts.
 *
 * UI contract: outline variant, sm size, Share2 icon, "Share" label,
 * "Copy link to this view" tooltip — must mirror the sibling Edit button
 * exactly per 09-UI-SPEC.md and project memory feedback_design_consistency.md.
 */
export function ShareLinkButton() {
  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm" onClick={handleClick}>
            <Share2 className="mr-1.5 size-4" />
            Share
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy link to this view</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

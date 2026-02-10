import { createFileRoute } from '@tanstack/react-router'

import ExplorerPage from '@/pages/explorer'

export const Route = createFileRoute('/explorer/')({
  component: ExplorerPage,
})

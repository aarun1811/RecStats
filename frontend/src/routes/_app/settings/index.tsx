import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'

import { useTheme } from '@/components/layout/theme-provider'
import { useSavedViews, useDeleteView } from '@/hooks/use-saved-views'
import { useDisplayStore } from '@/stores/display-store'
import { DataSourcesTab } from '@/components/settings/data-sources-tab'
import { ThemePreviewCard } from '@/components/settings/theme-preview-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Trash2,
  ExternalLink,
  Palette,
  BookmarkCheck,
  Server,
} from 'lucide-react'

export const Route = createFileRoute('/_app/settings/')({
  component: Settings,
})

// ── Tab content transition config ─────────────────────────────

const TAB_TRANSITION = {
  duration: 0.2,
  ease: [0.25, 0.46, 0.45, 0.94],
} as const

// ── Settings ──────────────────────────────────────────────────

function Settings() {
  const { theme, setTheme } = useTheme()
  const { data: savedViews = [], isLoading: viewsLoading } = useSavedViews()
  const deleteViewMutation = useDeleteView()
  const [activeTab, setActiveTab] = useState('appearance')

  const density = useDisplayStore((s) => s.density)
  const fontSize = useDisplayStore((s) => s.fontSize)
  const setDensity = useDisplayStore((s) => s.setDensity)
  const setFontSize = useDisplayStore((s) => s.setFontSize)

  function handleDeleteView(id: string, name: string) {
    deleteViewMutation.mutate(id, {
      onSuccess: () => toast.success(`Deleted "${name}"`),
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage preferences, saved views, and data sources
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="appearance" className="gap-1.5">
            <Palette className="size-3.5" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="saved-views" className="gap-1.5">
            <BookmarkCheck className="size-3.5" />
            Saved Views
          </TabsTrigger>
          <TabsTrigger value="data-sources" className="gap-1.5">
            <Server className="size-3.5" />
            Data Sources
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <TabsContent value="appearance" className="mt-4" forceMount>
              <motion.div
                key="appearance"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={TAB_TRANSITION}
                className="space-y-6"
              >
                {/* Theme Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Theme</CardTitle>
                    <CardDescription>
                      Choose between light, dark, or system theme
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4">
                      <ThemePreviewCard
                        theme="light"
                        isSelected={theme === 'light'}
                        onClick={() => setTheme('light')}
                      />
                      <ThemePreviewCard
                        theme="dark"
                        isSelected={theme === 'dark'}
                        onClick={() => setTheme('dark')}
                      />
                      <ThemePreviewCard
                        theme="system"
                        isSelected={theme === 'system'}
                        onClick={() => setTheme('system')}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Display Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Display</CardTitle>
                    <CardDescription>
                      Density and font size preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Density</Label>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        value={density}
                        onValueChange={(v) => {
                          if (v) setDensity(v as 'comfortable' | 'compact')
                        }}
                      >
                        <ToggleGroupItem value="comfortable" className="text-xs">
                          Comfortable
                        </ToggleGroupItem>
                        <ToggleGroupItem value="compact" className="text-xs">
                          Compact
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <Label>Font Size</Label>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        value={fontSize}
                        onValueChange={(v) => {
                          if (v) setFontSize(v as 'small' | 'medium' | 'large')
                        }}
                      >
                        <ToggleGroupItem value="small" className="text-xs">
                          Small
                        </ToggleGroupItem>
                        <ToggleGroupItem value="medium" className="text-xs">
                          Medium
                        </ToggleGroupItem>
                        <ToggleGroupItem value="large" className="text-xs">
                          Large
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          )}

          {/* Saved Views Tab */}
          {activeTab === 'saved-views' && (
            <TabsContent value="saved-views" className="mt-4" forceMount>
              <motion.div
                key="saved-views"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={TAB_TRANSITION}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Saved Views</CardTitle>
                    <CardDescription>
                      Filter + layout combinations you&apos;ve saved from dashboards
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {viewsLoading ? (
                      <p className="text-sm text-muted-foreground py-4">Loading...</p>
                    ) : savedViews.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <BookmarkCheck className="size-10 mx-auto mb-2 opacity-40" />
                        <p className="font-medium text-sm">No saved views yet</p>
                        <p className="text-xs mt-1">
                          Use the &quot;Save View&quot; button on any dashboard to save your current filters.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {savedViews.map((view) => (
                          <div
                            key={view.id}
                            className="flex items-center justify-between rounded-lg border p-3"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{view.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px]">
                                  {view.dashboardId}
                                </Badge>
                                {view.createdAt && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(view.createdAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="outline" className="h-7 text-xs">
                                <ExternalLink className="mr-1 size-3" />
                                Load
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteView(view.id, view.name)}
                                aria-label={`Delete ${view.name}`}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          )}

          {/* Data Sources Tab */}
          {activeTab === 'data-sources' && (
            <TabsContent value="data-sources" className="mt-4" forceMount>
              <motion.div
                key="data-sources"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={TAB_TRANSITION}
              >
                <DataSourcesTab />
              </motion.div>
            </TabsContent>
          )}
        </AnimatePresence>
      </Tabs>
    </div>
  )
}

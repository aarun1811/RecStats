import { createFileRoute } from '@tanstack/react-router'
import { useTheme } from '@/components/layout/theme-provider'
import { useSavedViews, useDeleteView } from '@/hooks/use-saved-views'
import { DataSourcesTab } from '@/components/settings/data-sources-tab'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Sun,
  Moon,
  Monitor,
  Trash2,
  ExternalLink,
  Palette,
  BookmarkCheck,
  Server,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/settings/')({
  component: Settings,
})

function Settings() {
  const { theme, setTheme } = useTheme()
  const { data: savedViews = [], isLoading: viewsLoading } = useSavedViews()
  const deleteViewMutation = useDeleteView()
  const handleDeleteView = (id: string, name: string) => {
    deleteViewMutation.mutate(id, {
      onSuccess: () => toast.success(`Deleted "${name}"`),
    })
  }

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ]

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage preferences, saved views, and data sources
        </p>
      </div>

      <Tabs defaultValue="appearance">
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

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Theme</CardTitle>
              <CardDescription>
                Choose between light, dark, or system theme
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {themeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors cursor-pointer min-w-[100px]',
                      theme === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/30',
                    )}
                  >
                    <opt.icon className={cn('size-5', theme === opt.value ? 'text-primary' : 'text-muted-foreground')} />
                    <span className={cn('text-sm font-medium', theme === opt.value ? 'text-primary' : 'text-muted-foreground')}>
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Display</CardTitle>
              <CardDescription>
                Density and font size preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Density</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-xs">
                    Comfortable
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs">
                    Compact
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label>Font Size</Label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-xs">
                    Small
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs">
                    Medium
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs">
                    Large
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Saved Views Tab */}
        <TabsContent value="saved-views" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Saved Views</CardTitle>
              <CardDescription>
                Filter + layout combinations you've saved from dashboards
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
                    Use the "Save View" button on any dashboard to save your current filters.
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
        </TabsContent>

        {/* Data Sources Tab */}
        <TabsContent value="data-sources" className="mt-4">
          <DataSourcesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

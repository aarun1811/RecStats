// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { EmbedTopbar } from './embed-topbar'

describe('EmbedTopbar', () => {
  it('renders the "Open in RecViz" link by default', () => {
    render(
      <EmbedTopbar title="TLM Statistics" dashboardId="dash-tlm-stats" filterParams="" />,
    )
    expect(screen.queryByText('Open in RecViz')).not.toBeNull()
  })

  it('renders the "Open in RecViz" link when hideOpenInLink is false', () => {
    render(
      <EmbedTopbar
        title="TLM Statistics"
        dashboardId="dash-tlm-stats"
        filterParams=""
        hideOpenInLink={false}
      />,
    )
    expect(screen.queryByText('Open in RecViz')).not.toBeNull()
  })

  it('hides the "Open in RecViz" link when hideOpenInLink is true', () => {
    render(
      <EmbedTopbar
        title="TLM Statistics"
        dashboardId="dash-tlm-stats"
        filterParams=""
        hideOpenInLink={true}
      />,
    )
    expect(screen.queryByText('Open in RecViz')).toBeNull()
  })

  it('still renders the title when the link is hidden', () => {
    render(
      <EmbedTopbar
        title="TLM Statistics"
        dashboardId="dash-tlm-stats"
        filterParams=""
        hideOpenInLink={true}
      />,
    )
    expect(screen.queryByText('TLM Statistics')).not.toBeNull()
  })
})

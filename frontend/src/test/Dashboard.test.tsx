import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Dashboard from '../pages/Dashboard'

const mockFetch = vi.fn()
globalThis.fetch = mockFetch

function mockResponse(data: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(data) })
}

beforeEach(() => {
  mockFetch.mockReset()
  mockFetch.mockImplementation((url: string | URL) => {
    const urlStr = String(url)
    if (urlStr.startsWith('/api/channels')) return mockResponse([{ id: 1, name: 'C1', niche: 'Tech' }])
    if (urlStr.startsWith('/api/packages')) return mockResponse([
      { id: 1, status: 'APPROVED', created_at: '2026-01-01T00:00:00', sections: [] },
      { id: 2, status: 'NEEDS_IMPROVEMENT', created_at: '2026-01-02T00:00:00', sections: [] },
    ])
    return mockResponse([])
  })
})

function renderDashboard() {
  return render(
    <BrowserRouter>
      <Dashboard />
    </BrowserRouter>
  )
}

describe('Dashboard', () => {
  it('renders dashboard heading after load', async () => {
    renderDashboard()
    await act(async () => {
      await vi.dynamicImportSettled()
    })
    await waitFor(() => {
      const heading = screen.queryByText('Dashboard')
      if (!heading) screen.debug()
      expect(heading).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('calls api endpoints on mount', async () => {
    renderDashboard()
    await act(async () => {
      await vi.dynamicImportSettled()
    })
    await waitFor(() => {
      const calls = mockFetch.mock.calls.map((c: unknown[]) => String(c[0]))
      expect(calls.some((c: string) => c.startsWith('/api/channels'))).toBe(true)
      expect(calls.some((c: string) => c.startsWith('/api/packages'))).toBe(true)
    }, { timeout: 3000 })
  })

  it('shows error state on fetch failure', async () => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({ detail: 'Server down' }) })
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Server down')).toBeInTheDocument(), { timeout: 3000 })
  })
})

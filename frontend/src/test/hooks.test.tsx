import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useChannels, useWorkflows, useSkills, usePackages } from '../hooks/useApi'

const mockFetch = vi.fn()
globalThis.fetch = mockFetch

function mockResponse(data: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(data) }
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('useChannels', () => {
  it('returns loading=true initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useChannels())
    expect(result.current.loading).toBe(true)
    expect(result.current.channels).toEqual([])
  })

  it('loads channels on mount', async () => {
    mockFetch.mockResolvedValue(mockResponse([{ id: 1, name: 'C1' }]))
    const { result } = renderHook(() => useChannels())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.channels).toEqual([{ id: 1, name: 'C1' }])
  })

  it('handles fetch error', async () => {
    mockFetch.mockResolvedValue(mockResponse({ detail: 'Failed' }, false))
    const { result } = renderHook(() => useChannels())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Failed')
  })
})

describe('useWorkflows', () => {
  it('loads workflows on mount', async () => {
    mockFetch.mockResolvedValue(mockResponse([{ id: 1, name: 'W1' }]))
    const { result } = renderHook(() => useWorkflows())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.workflows).toEqual([{ id: 1, name: 'W1' }])
  })
})

describe('useSkills', () => {
  it('loads skills on mount', async () => {
    mockFetch.mockResolvedValue(mockResponse([{ id: 1, name: 'S1', category: 'script' }]))
    const { result } = renderHook(() => useSkills())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.skills).toEqual([{ id: 1, name: 'S1', category: 'script' }])
  })
})

describe('usePackages', () => {
  it('loads packages on mount', async () => {
    mockFetch.mockResolvedValue(mockResponse([{ id: 1, status: 'APPROVED' }]))
    const { result } = renderHook(() => usePackages())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.packages).toEqual([{ id: 1, status: 'APPROVED' }])
  })

  it('passes channelId and status as query params', async () => {
    mockFetch.mockResolvedValue(mockResponse([]))
    renderHook(() => usePackages(1, 'APPROVED'))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('channel_id=1'),
        expect.anything()
      )
    })
  })

  it('handles fetch error', async () => {
    mockFetch.mockResolvedValue(mockResponse({ detail: 'Failed' }, false))
    const { result } = renderHook(() => usePackages())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Failed')
  })
})

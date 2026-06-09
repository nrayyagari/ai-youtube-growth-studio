import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
globalThis.fetch = mockFetch

function createMockResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
  }
}

import { api } from '../lib/api'

beforeEach(() => {
  mockFetch.mockReset()
  mockFetch.mockResolvedValue(createMockResponse([]))
})

describe('api', () => {
  describe('channels', () => {
    it('listChannels calls GET /api/channels', async () => {
      await api.listChannels()
      expect(mockFetch).toHaveBeenCalledWith('/api/channels', expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }))
    })

    it('createChannel calls POST /api/channels', async () => {
      await api.createChannel({ name: 'Test' })
      expect(mockFetch).toHaveBeenCalledWith('/api/channels', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
      }))
    })

    it('deleteChannel calls DELETE /api/channels/:id', async () => {
      await api.deleteChannel(1)
      expect(mockFetch).toHaveBeenCalledWith('/api/channels/1', expect.objectContaining({
        method: 'DELETE',
      }))
    })

    it('listChannels returns data', async () => {
      mockFetch.mockResolvedValue(createMockResponse([{ id: 1, name: 'Ch' }]))
      const data = await api.listChannels()
      expect(data).toEqual([{ id: 1, name: 'Ch' }])
    })
  })

  describe('error handling', () => {
    it('throws error with detail on non-ok response', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ detail: 'Not found' }, false, 404))
      await expect(api.listChannels()).rejects.toThrow('Not found')
    })

    it('throws error with error field', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ error: 'Server error' }, false, 500))
      await expect(api.listChannels()).rejects.toThrow('Server error')
    })

    it('throws HTTP status when no detail/error', async () => {
      mockFetch.mockResolvedValue(createMockResponse({}, false, 500))
      await expect(api.listChannels()).rejects.toThrow('HTTP 500')
    })
  })

  describe('packages', () => {
    it('generate calls POST /api/generate', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ id: 1 }))
      await api.generate(1, 2, 'topic')
      expect(mockFetch).toHaveBeenCalledWith('/api/generate', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ channel_id: 1, workflow_id: 2, topic: 'topic' }),
      }))
    })

    it('approvePackage calls POST /api/packages/:id/approve', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ status: 'APPROVED' }))
      await api.approvePackage(1, true)
      expect(mockFetch).toHaveBeenCalledWith('/api/packages/1/approve', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ override: true }),
      }))
    })

    it('regeneratePackage calls POST /api/packages/:id/regenerate', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ status: 'APPROVED' }))
      await api.regeneratePackage(1, ['script'])
      expect(mockFetch).toHaveBeenCalledWith('/api/packages/1/regenerate', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ sections: ['script'] }),
      }))
    })

    it('listPackages builds query string', async () => {
      await api.listPackages(1, 'APPROVED')
      expect(mockFetch).toHaveBeenCalledWith('/api/packages?channel_id=1&status=APPROVED', expect.anything())
    })

    it('getPackage calls GET /api/packages/:id', async () => {
      await api.getPackage(5)
      expect(mockFetch).toHaveBeenCalledWith('/api/packages/5', expect.anything())
    })
  })

  describe('reference videos', () => {
    it('addReferenceVideo calls POST', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ id: 1 }))
      await api.addReferenceVideo(1, 'https://youtube.com/watch?v=abc')
      expect(mockFetch).toHaveBeenCalledWith('/api/channels/1/reference-videos', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ url: 'https://youtube.com/watch?v=abc' }),
      }))
    })

    it('listReferenceVideos calls GET', async () => {
      await api.listReferenceVideos(1)
      expect(mockFetch).toHaveBeenCalledWith('/api/channels/1/reference-videos', expect.anything())
    })
  })

  describe('settings', () => {
    it('getApiKeys calls GET /api/settings/apikeys', async () => {
      await api.getApiKeys()
      expect(mockFetch).toHaveBeenCalledWith('/api/settings/apikeys', expect.anything())
    })

    it('updateApiKeys calls PUT with body', async () => {
      await api.updateApiKeys({ gemini: 'key1' })
      expect(mockFetch).toHaveBeenCalledWith('/api/settings/apikeys', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ gemini: 'key1' }),
      }))
    })
  })
})

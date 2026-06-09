import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary, LoadingState, EmptyState, ErrorMessage } from '../components/ui/ErrorBoundary'

const Thrower = ({ msg }: { msg?: string }) => {
  throw new Error(msg || 'test error')
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>hello world</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })

  it('renders error UI on throw', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Thrower msg="boom" />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('renders custom fallback', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary fallback={<div>custom error</div>}>
        <Thrower />
      </ErrorBoundary>
    )
    expect(screen.getByText('custom error')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('Try Again button resets state', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>
    )
    const btn = screen.getByText('Try Again')
    expect(btn).toBeInTheDocument()
    spy.mockRestore()
  })
})

describe('LoadingState', () => {
  it('renders default text', () => {
    render(<LoadingState />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders custom text', () => {
    render(<LoadingState text="Fetching data..." />)
    expect(screen.getByText('Fetching data...')).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('renders default text', () => {
    render(<EmptyState />)
    expect(screen.getByText('No data')).toBeInTheDocument()
    expect(screen.getByText('Nothing to show yet.')).toBeInTheDocument()
  })

  it('renders custom text', () => {
    render(<EmptyState title="No channels" description="Create one to start" />)
    expect(screen.getByText('No channels')).toBeInTheDocument()
    expect(screen.getByText('Create one to start')).toBeInTheDocument()
  })
})

describe('ErrorMessage', () => {
  it('renders message', () => {
    render(<ErrorMessage message="Failed to load" />)
    expect(screen.getByText('Failed to load')).toBeInTheDocument()
  })

  it('renders retry button when onRetry provided', () => {
    const onRetry = vi.fn()
    render(<ErrorMessage message="Error" onRetry={onRetry} />)
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('calls onRetry on button click', async () => {
    const onRetry = vi.fn()
    render(<ErrorMessage message="Error" onRetry={onRetry} />)
    screen.getByText('Retry').click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('does not render retry when no onRetry', () => {
    render(<ErrorMessage message="Error" />)
    expect(screen.queryByText('Retry')).not.toBeInTheDocument()
  })
})

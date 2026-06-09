import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 300,
          padding: 40,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: "#e94560", marginBottom: 8, fontSize: 20 }}>Something went wrong</h2>
          <p style={{ color: "#888", fontSize: 14, marginBottom: 16, maxWidth: 400 }}>
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "10px 24px",
              background: "#e94560",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function LoadingState({ text = "Loading..." }: { text?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, color: "#888" }}>
      <div style={{ fontSize: 14 }}>{text}</div>
    </div>
  );
}

export function EmptyState({ title = "No data", description = "Nothing to show yet." }: { title?: string; description?: string }) {
  return (
    <div style={{ textAlign: "center", padding: 48, color: "#666" }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
      <h3 style={{ fontSize: 16, marginBottom: 4, color: "#888" }}>{title}</h3>
      <p style={{ fontSize: 13 }}>{description}</p>
    </div>
  );
}

export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{
      padding: 12,
      background: "rgba(233, 69, 96, 0.15)",
      border: "1px solid rgba(233, 69, 96, 0.3)",
      borderRadius: 6,
      color: "#ef9a9a",
      fontSize: 13,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    }}>
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} style={{ padding: "4px 12px", background: "transparent", border: "1px solid #ef9a9a", borderRadius: 4, color: "#ef9a9a", cursor: "pointer", fontSize: 11 }}>
          Retry
        </button>
      )}
    </div>
  );
}

import { Component, type ReactNode } from "react";
import { reportClientError } from "../services/errorReporting";

interface State {
  error: Error | null;
}

/** If any screen throws while rendering, show a calm recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    reportClientError("render", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="setup">
        <div className="card">
          <h1>Oops, Teddy got tangled up</h1>
          <p className="muted">Something went wrong on this screen. Your saved children are safe.</p>
          <pre className="error-detail">{this.state.error.message}</pre>
          <button className="primary" onClick={() => location.reload()}>
            Start again
          </button>
        </div>
      </main>
    );
  }
}

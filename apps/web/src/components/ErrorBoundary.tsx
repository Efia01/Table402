import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    void error;
    void info;
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full border border-crimson/50 bg-crimson/10 text-2xl text-crimson-soft">
            !
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-bone">
              Something hiccuped
            </h1>
            <p className="mt-2 break-words text-sm text-bone-dim">{this.state.error.message}</p>
          </div>
          <button onClick={() => location.reload()} className="btn-hero w-full justify-center py-3.5">
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import { Component } from 'react';

/**
 * Catches render errors so a single feature crash does not white-screen the whole app.
 */
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const title = this.props.title || 'Something went wrong';
    const detail =
      this.props.detail ||
      'This screen hit an unexpected error. You can try again or reload the app.';

    return (
      <div className="app-error-boundary" role="alert">
        <div className="app-error-boundary__card">
          <h1 className="app-error-boundary__title">{title}</h1>
          <p className="app-error-boundary__detail">{detail}</p>
          {import.meta.env.DEV ? (
            <pre className="app-error-boundary__stack">{String(error?.message || error)}</pre>
          ) : null}
          <div className="app-error-boundary__actions">
            <button type="button" className="btn" onClick={this.handleRetry}>
              Try again
            </button>
            <button type="button" className="btn secondary" onClick={this.handleReload}>
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}

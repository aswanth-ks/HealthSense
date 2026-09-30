import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

// Keeps one broken page from blanking the whole app; resets when the route changes.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="card flex flex-col items-center px-6 py-14 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-amber-50 text-amber-600"><AlertTriangle size={26} /></span>
        <h2 className="mt-5 text-lg font-medium">Something went wrong on this page</h2>
        <p className="mt-1 max-w-md text-sm text-ink-soft">{String(this.state.error.message || this.state.error)}</p>
        <button onClick={() => this.setState({ error: null })} className="mt-5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-700">Try again</button>
      </section>
    );
  }
}

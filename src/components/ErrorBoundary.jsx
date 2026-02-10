import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[ErrorBoundary${this.props.section ? ` - ${this.props.section}` : ''}]`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <span className="error-icon">⚠️</span>
            <h4>Something went wrong{this.props.section ? ` in ${this.props.section}` : ''}</h4>
            <p className="error-message">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button className="error-reset-btn" onClick={this.handleReset}>
              🔄 Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

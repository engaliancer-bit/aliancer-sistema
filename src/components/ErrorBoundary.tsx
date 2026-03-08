import React, { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error:', error.message);

    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
            <div className="flex items-center gap-4 mb-6">
              <AlertTriangle className="w-12 h-12 text-red-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Erro na Aplicação
                </h1>
                <p className="text-gray-600">
                  Algo deu errado. Por favor, recarregue a página.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-red-900 mb-2">Erro:</h3>
                <pre className="text-sm text-red-800 overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </div>
            )}

            {this.state.errorInfo && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-gray-900 mb-2">Stack Trace:</h3>
                <pre className="text-xs text-gray-700 overflow-auto max-h-64">
                  {this.state.errorInfo.componentStack}
                </pre>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

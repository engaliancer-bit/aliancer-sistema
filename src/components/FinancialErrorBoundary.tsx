import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackComponent?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  lastErrorTime: number;
}

class FinancialErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const now = Date.now();
    const timeSinceLastError = now - this.state.lastErrorTime;

    console.group('🚨 [FinancialErrorBoundary] Error Caught');
    console.error('Component:', this.props.componentName || 'Unknown');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('Error Count:', this.state.errorCount + 1);
    console.error('Time Since Last Error:', timeSinceLastError, 'ms');
    console.groupEnd();

    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
      lastErrorTime: now,
    }));

    this.logErrorToServer(error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    if (this.state.errorCount > 5 && timeSinceLastError < 60000) {
      console.error('🔥 [FinancialErrorBoundary] Too many errors in short time - possible infinite loop');
      this.setState({ errorCount: 0 });
    }
  }

  logErrorToServer(error: Error, errorInfo: ErrorInfo) {
    const errorData = {
      timestamp: new Date().toISOString(),
      component: this.props.componentName || 'Unknown',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
      url: window.location.href,
      userAgent: navigator.userAgent,
      errorCount: this.state.errorCount,
    };

    console.log('📤 [FinancialErrorBoundary] Error data prepared for logging:', errorData);
  }

  handleReset = () => {
    console.log('🔄 [FinancialErrorBoundary] Resetting error boundary');
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    console.log('🔄 [FinancialErrorBoundary] Reloading page');
    window.location.reload();
  };

  handleGoHome = () => {
    console.log('🏠 [FinancialErrorBoundary] Navigating to home');
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-12 h-12 text-red-600" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Erro no Componente Financeiro
                </h1>
                <p className="text-gray-600 mb-4">
                  Ocorreu um erro inesperado ao processar esta operação financeira.
                  Seus dados estão seguros e nenhuma transação foi completada.
                </p>

                {this.props.componentName && (
                  <div className="mb-4 p-3 bg-gray-100 rounded">
                    <p className="text-sm text-gray-700">
                      <strong>Componente:</strong> {this.props.componentName}
                    </p>
                  </div>
                )}

                {this.state.error && (
                  <details className="mb-4">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                      Detalhes técnicos (para desenvolvedores)
                    </summary>
                    <div className="mt-2 p-4 bg-red-50 border border-red-200 rounded text-sm">
                      <p className="font-mono text-red-800 mb-2">
                        <strong>Erro:</strong> {this.state.error.message}
                      </p>
                      {this.state.error.stack && (
                        <pre className="text-xs text-red-700 overflow-x-auto">
                          {this.state.error.stack}
                        </pre>
                      )}
                      {this.state.errorInfo && (
                        <pre className="mt-2 text-xs text-red-700 overflow-x-auto">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      )}
                    </div>
                  </details>
                )}

                {this.state.errorCount > 1 && (
                  <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded">
                    <p className="text-sm text-orange-800">
                      ⚠️ Este erro ocorreu {this.state.errorCount} vezes. Se persistir, considere recarregar a página.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={this.handleReset}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Tentar Novamente
                  </button>
                  <button
                    onClick={this.handleReload}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Recarregar Página
                  </button>
                  <button
                    onClick={this.handleGoHome}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <Home className="w-4 h-4" />
                    Ir para Início
                  </button>
                </div>

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
                  <h3 className="text-sm font-medium text-blue-900 mb-2">
                    💡 O que fazer agora?
                  </h3>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>Clique em "Tentar Novamente" para recarregar apenas este componente</li>
                    <li>Se o erro persistir, recarregue a página completa</li>
                    <li>Verifique sua conexão com a internet</li>
                    <li>Se continuar com problemas, contate o suporte técnico</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default FinancialErrorBoundary;

export const withFinancialErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) => {
  const WrappedComponent = (props: P) => (
    <FinancialErrorBoundary componentName={componentName || Component.name}>
      <Component {...props} />
    </FinancialErrorBoundary>
  );

  WrappedComponent.displayName = `withFinancialErrorBoundary(${
    componentName || Component.name || 'Component'
  })`;

  return WrappedComponent;
};

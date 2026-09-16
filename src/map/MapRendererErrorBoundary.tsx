import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface MapRendererErrorBoundaryProps {
  children: React.ReactNode;
  basemapType: string;
  resetKey: string;
  onResetToBuiltinMap: () => void;
}

interface MapRendererErrorBoundaryState {
  error: Error | null;
}

export class MapRendererErrorBoundary extends React.Component<
  MapRendererErrorBoundaryProps,
  MapRendererErrorBoundaryState
> {
  state: MapRendererErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): MapRendererErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Map renderer failed', error, info);
  }

  componentDidUpdate(previousProps: MapRendererErrorBoundaryProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private retry = () => {
    this.setState({ error: null });
  };

  private resetToBuiltin = () => {
    this.props.onResetToBuiltinMap();
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        className="flex h-full w-full items-center justify-center bg-slate-100 p-6"
      >
        <div className="w-full max-w-lg rounded-xl border border-rose-200 bg-white p-6 text-center shadow-lg">
          <AlertTriangle className="mx-auto mb-3 text-rose-500" size={32} />
          <h2 className="text-base font-semibold text-slate-900">地图渲染发生错误</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            项目数据仍然保留。你可以重试当前地图，或切换回内置地图继续编辑。
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={this.retry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={14} />
              保留项目并重试
            </button>
            <button
              type="button"
              onClick={this.resetToBuiltin}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              <RotateCcw size={14} />
              恢复到内置地图
            </button>
          </div>
          {import.meta.env.DEV && (
            <details className="mt-5 rounded-lg bg-slate-950 p-3 text-left text-[11px] text-slate-200">
              <summary className="cursor-pointer font-medium">开发诊断信息</summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">
                {`basemap: ${this.props.basemapType}\n${error.stack || error.message}`}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

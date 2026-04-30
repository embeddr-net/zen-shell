import React from "react";
import { Button } from "@embeddr/react-ui";

interface PluginErrorBoundaryProps {
  pluginId: string;
  componentName: string;
  children: React.ReactNode;
}

interface PluginErrorBoundaryState {
  error?: Error;
}

export class PluginErrorBoundary extends React.Component<
  PluginErrorBoundaryProps,
  PluginErrorBoundaryState
> {
  state: PluginErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[PluginErrorBoundary] Plugin crashed", {
      pluginId: this.props.pluginId,
      componentName: this.props.componentName,
      error,
    });
  }

  handleReset = () => {
    this.setState({ error: undefined });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="h-full w-full p-4 flex flex-col gap-3">
          <div className="text-sm font-semibold text-destructive">Plugin crashed</div>
          <div className="text-xs text-muted-foreground">
            {this.props.pluginId} / {this.props.componentName}
          </div>
          <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
            {this.state.error.message}
          </pre>
          <div>
            <Button size="sm" onClick={this.handleReset}>
              Reset panel
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

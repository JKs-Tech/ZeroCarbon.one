import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Box, Button } from '@mui/material';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  public state: State = { hasError: false, message: '' };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Something went wrong' };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI error boundary', error, info);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Box p={4}>
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={() => window.location.assign('/dashboard')}>
                Go to Dashboard
              </Button>
            }
          >
            {this.state.message}
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}

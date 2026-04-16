import { Toaster } from 'react-hot-toast';

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 5000,
        style: {
          background: '#111827',
          color: '#F9FAFB',
          borderRadius: '0.75rem',
        },
        error: {
          duration: 6000,
        },
      }}
    />
  );
}

export default AppToaster;

import { Toaster } from 'react-hot-toast';

import { useTheme } from '../../hooks/useTheme';

export function AppToaster() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 5000,
        style: {
          background: isDark ? '#18181b' : '#ffffff',
          color: isDark ? '#f4f4f5' : '#111827',
          border: `1px solid ${isDark ? '#3f3f46' : '#e5e7eb'}`,
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

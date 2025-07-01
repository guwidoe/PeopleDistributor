import { useAppStore } from '../store';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export function NotificationContainer() {
  const { ui, removeNotification } = useAppStore();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return CheckCircle;
      case 'error':
        return AlertCircle;
      case 'warning':
        return AlertTriangle;
      case 'info':
        return Info;
      default:
        return Info;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'success':
        return { color: 'var(--color-success-600)' };
      case 'error':
        return { color: 'var(--color-error-600)' };
      case 'warning':
        return { color: 'var(--color-warning-600)' };
      case 'info':
        return { color: 'var(--color-accent)' };
      default:
        return { color: 'var(--text-secondary)' };
    }
  };

  const getBgStyle = (type: string) => {
    const baseStyle = {
      backgroundColor: 'var(--bg-primary)',
      borderColor: 'var(--border-primary)',
      backdropFilter: 'blur(12px)',
    };
    
    switch (type) {
      case 'success':
        return { ...baseStyle, borderColor: 'var(--color-success-300)' };
      case 'error':
        return { ...baseStyle, borderColor: 'var(--color-error-300)' };
      case 'warning':
        return { ...baseStyle, borderColor: 'var(--color-warning-300)' };
      case 'info':
        return { ...baseStyle, borderColor: 'var(--color-accent)' };
      default:
        return baseStyle;
    }
  };

  if (ui.notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {ui.notifications.map((notification) => {
        const Icon = getIcon(notification.type);
        
        return (
          <div
            key={notification.id}
            className="border rounded-lg p-4 shadow-lg animate-slide-up"
            style={{
              ...getBgStyle(notification.type),
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div className="flex items-start space-x-3">
              <Icon className="h-5 w-5 mt-0.5" style={getIconColor(notification.type)} />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {notification.title}
                </h4>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {notification.message}
                </p>
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className="transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
} 
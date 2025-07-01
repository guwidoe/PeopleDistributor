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
        return 'text-success-500';
      case 'error':
        return 'text-error-500';
      case 'warning':
        return 'text-warning-500';
      case 'info':
        return 'text-primary-500';
      default:
        return 'text-gray-500';
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-success-50 border-success-200';
      case 'error':
        return 'bg-error-50 border-error-200';
      case 'warning':
        return 'bg-warning-50 border-warning-200';
      case 'info':
        return 'bg-primary-50 border-primary-200';
      default:
        return 'bg-gray-50 border-gray-200';
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
            className={`${getBgColor(notification.type)} border rounded-lg p-4 shadow-lg animate-slide-up bg-white/70 backdrop-blur-lg`}
            style={{ boxShadow: '0 4px 24px 0 rgba(0,0,0,0.10)' }}
          >
            <div className="flex items-start space-x-3">
              <Icon className={`h-5 w-5 mt-0.5 ${getIconColor(notification.type)}`} />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {notification.title}
                </h4>
                <p className="text-sm text-gray-700 mt-1">
                  {notification.message}
                </p>
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
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
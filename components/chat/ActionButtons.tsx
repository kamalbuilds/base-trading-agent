'use client';

interface ActionButtonsProps {
  actions: any[];
}

export function ActionButtons({ actions }: ActionButtonsProps) {
  const handleAction = (action: any) => {
    console.log('Action clicked:', action);
    // Handle different action types
    switch (action.type) {
      case 'transaction':
        // Handle transaction approval
        break;
      case 'miniapp':
        // Launch mini-app
        break;
      case 'notification':
        // Show notification
        break;
      default:
        console.log('Unknown action type:', action.type);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={() => handleAction(action)}
          className="bg-white/20 hover:bg-white/30 text-white text-sm px-3 py-1 rounded-lg border border-white/30 transition-colors"
        >
          {action.type === 'transaction' && '💰 Approve Transaction'}
          {action.type === 'miniapp' && '🚀 Launch App'}
          {action.type === 'notification' && '🔔 View Details'}
        </button>
      ))}
    </div>
  );
}
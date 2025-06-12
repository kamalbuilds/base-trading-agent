'use client';

interface QuickActionsProps {
  selectedAgent: string;
  onActionSelect: (action: string) => void;
}

export function QuickActions({ selectedAgent, onActionSelect }: QuickActionsProps) {
  const getQuickActions = (agent: string) => {
    const actions = {
      master: [
        "Show available agents",
        "System health check",
        "Help me get started"
      ],
      utility: [
        "Plan an event",
        "Split a payment",
        "Track expenses",
        "Create shared wallet"
      ],
      trading: [
        "Check my portfolio",
        "Get token prices",
        "Set price alert",
        "Swap tokens"
      ],
      gaming: [
        "Start trivia game",
        "Play word chain",
        "Show leaderboard",
        "Place a bet"
      ],
      social: [
        "Latest crypto news",
        "Trending topics",
        "Market sentiment",
        "Personalized feed"
      ],
      miniapp: [
        "Launch calculator",
        "Currency converter",
        "Create poll",
        "Expense tracker"
      ]
    };
    
    return actions[agent as keyof typeof actions] || actions.master;
  };

  const quickActions = getQuickActions(selectedAgent);

  return (
    <div className="p-4 border-b border-gray-100 bg-gray-50/50">
      <div className="flex flex-wrap gap-2">
        {quickActions.map((action, index) => (
          <button
            key={index}
            onClick={() => onActionSelect(action)}
            className="bg-white hover:bg-gray-50 text-gray-700 text-sm px-3 py-1.5 rounded-lg border border-gray-200 transition-colors"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}
'use client';

interface AgentSelectorProps {
  selectedAgent: string;
  onAgentSelect: (agent: string) => void;
}

const agents = [
  {
    id: 'master',
    name: 'MasterAgent',
    description: 'Central orchestrator and router',
    icon: '🎯',
    color: 'from-blue-500 to-purple-500'
  },
  {
    id: 'utility',
    name: 'UtilityAgent',
    description: 'Event planning & payments',
    icon: '🛠️',
    color: 'from-green-500 to-teal-500'
  },
  {
    id: 'trading',
    name: 'TradingAgent',
    description: 'DeFi operations & trading',
    icon: '📈',
    color: 'from-orange-500 to-red-500'
  },
  {
    id: 'gaming',
    name: 'GameAgent',
    description: 'Interactive games & betting',
    icon: '🎮',
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: 'social',
    name: 'SocialAgent',
    description: 'Content curation & news',
    icon: '📰',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'miniapp',
    name: 'MiniAppAgent',
    description: 'Mini-app management',
    icon: '🚀',
    color: 'from-indigo-500 to-purple-500'
  }
];

export function AgentSelector({ selectedAgent, onAgentSelect }: AgentSelectorProps) {
  return (
    <div className="space-y-2">
      {agents.map((agent) => (
        <button
          key={agent.id}
          onClick={() => onAgentSelect(agent.id)}
          className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
            selectedAgent === agent.id
              ? 'border-blue-500 bg-blue-50 shadow-sm'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 bg-gradient-to-r ${agent.color} rounded-lg flex items-center justify-center text-white text-lg`}>
              {agent.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 truncate">
                {agent.name}
              </h3>
              <p className="text-sm text-gray-500 truncate">
                {agent.description}
              </p>
            </div>
            {selectedAgent === agent.id && (
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
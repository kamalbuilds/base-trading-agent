'use client';

interface AgentTypingProps {
  agentName: string;
}

export function AgentTyping({ agentName }: AgentTypingProps) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%]">
        <div className="flex items-center space-x-2 mb-1">
          <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-semibold">
              {agentName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-xs text-gray-500 capitalize">
            {agentName}Agent is typing...
          </span>
        </div>
        
        <div className="bg-gray-100 rounded-2xl px-4 py-3">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
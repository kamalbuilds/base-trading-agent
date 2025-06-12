'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { AgentTyping } from './AgentTyping';
import { QuickActions } from './QuickActions';
import { useAgents } from '../../hooks/useAgents';

interface ChatInterfaceProps {
  selectedAgent: string;
  walletAddress: string;
  conversationId: string;
}

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  agentName?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  actions?: any[];
}

export function ChatInterface({ selectedAgent, walletAddress, conversationId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Use the real agent system
  const { 
    isServerRunning, 
    sendMessage, 
    messages: agentMessages, 
    error,
    clearError 
  } = useAgents();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Add welcome message when agent changes
    if (selectedAgent) {
      const welcomeMessage: Message = {
        id: `welcome-${Date.now()}`,
        content: getWelcomeMessage(selectedAgent),
        sender: 'agent',
        agentName: selectedAgent,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [selectedAgent]);

  // Sync agent messages with local messages
  useEffect(() => {
    if (agentMessages.length > 0) {
      const lastAgentMessage = agentMessages[agentMessages.length - 1];
      const agentMessage: Message = {
        id: lastAgentMessage.id,
        content: lastAgentMessage.text,
        sender: 'agent',
        agentName: lastAgentMessage.agent,
        timestamp: new Date(lastAgentMessage.timestamp),
        actions: lastAgentMessage.actions,
      };
      
      setMessages(prev => {
        // Check if message already exists
        if (prev.some(msg => msg.id === agentMessage.id)) {
          return prev;
        }
        return [...prev, agentMessage];
      });
    }
  }, [agentMessages]);

  const getWelcomeMessage = (agent: string): string => {
    const welcomeMessages = {
      master: "👋 Hello! I'm the MasterAgent. I can help route your requests to the right specialist or handle system queries. What would you like to do today?",
      utility: "🛠️ Hi! I'm your UtilityAgent. I can help you plan events, split payments, track expenses, and manage group coordination. How can I assist you?",
      trading: "📈 Welcome! I'm the TradingAgent. I can help you with portfolio management, token swaps, price alerts, and market analysis. What would you like to trade or check?",
      game: "🎮 Hey there! I'm the GameAgent. Ready to play some games? I can start trivia, word games, or even handle betting. What sounds fun?",
      social: "📰 Hello! I'm the SocialAgent. I can curate crypto news, show trending topics, and provide personalized content. What interests you?",
      miniapp: "🚀 Hi! I'm the MiniAppAgent. I can launch calculators, converters, polls, and other useful tools. What app would you like to use?",
    };
    return welcomeMessages[agent as keyof typeof welcomeMessages] || "Hello! How can I help you today?";
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    // Clear any previous errors
    if (error) {
      clearError();
    }

    // Check if agents are running
    if (!isServerRunning) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: "⚠️ Agent server is not running. Please start the agents from the system status panel.",
        sender: 'agent',
        agentName: 'system',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Show typing indicator
    setIsTyping(true);

    try {
      // Send message to real agent system
      const result = await sendMessage(content, selectedAgent, conversationId, walletAddress);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: `❌ Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        sender: 'agent',
        agentName: selectedAgent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickAction = (action: string) => {
    handleSendMessage(action);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {selectedAgent.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 capitalize">
                {selectedAgent}Agent
              </h3>
              <p className="text-sm text-gray-500">
                {isServerRunning ? 'Connected via XMTP' : 'Agents offline'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isServerRunning ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-500">
              {isServerRunning ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-red-50 border-b border-red-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={clearError}
              className="text-red-600 hover:text-red-800 text-sm underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="p-4 border-b border-gray-200">
        <QuickActions 
          selectedAgent={selectedAgent}
          onActionSelect={handleQuickAction}
        />
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-4">
          <MessageList messages={messages} />
          {isTyping && <AgentTyping agentName={selectedAgent} />}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-gray-200">
          <MessageInput 
            onSendMessage={handleSendMessage}
            disabled={!isServerRunning || isTyping}
            placeholder={
              !isServerRunning 
                ? "Start the agent server to begin chatting..."
                : isTyping 
                ? "Agent is typing..."
                : `Message ${selectedAgent}Agent...`
            }
          />
        </div>
      </div>
    </div>
  );
}
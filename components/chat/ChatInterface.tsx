'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { AgentTyping } from './AgentTyping';
import { QuickActions } from './QuickActions';

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
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const getWelcomeMessage = (agent: string): string => {
    const welcomeMessages = {
      master: "👋 Hello! I'm the MasterAgent. I can help route your requests to the right specialist or handle system queries. What would you like to do today?",
      utility: "🛠️ Hi! I'm your UtilityAgent. I can help you plan events, split payments, track expenses, and manage group coordination. How can I assist you?",
      trading: "📈 Welcome! I'm the TradingAgent. I can help you with portfolio management, token swaps, price alerts, and market analysis. What would you like to trade or check?",
      gaming: "🎮 Hey there! I'm the GameAgent. Ready to play some games? I can start trivia, word games, or even handle betting. What sounds fun?",
      social: "📰 Hello! I'm the SocialAgent. I can curate crypto news, show trending topics, and provide personalized content. What interests you?",
      miniapp: "🚀 Hi! I'm the MiniAppAgent. I can launch calculators, converters, polls, and other useful tools. What app would you like to use?",
    };
    return welcomeMessages[agent as keyof typeof welcomeMessages] || "Hello! How can I help you today?";
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

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
      // Simulate API call to agent system
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      // Generate agent response based on content and selected agent
      const agentResponse = await generateAgentResponse(content, selectedAgent);
      
      const agentMessage: Message = {
        id: `agent-${Date.now()}`,
        content: agentResponse.message,
        sender: 'agent',
        agentName: selectedAgent,
        timestamp: new Date(),
        metadata: agentResponse.metadata,
        actions: agentResponse.actions,
      };

      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: "Sorry, I encountered an error processing your message. Please try again.",
        sender: 'agent',
        agentName: selectedAgent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const generateAgentResponse = async (content: string, agent: string) => {
    // Mock agent responses based on content and agent type
    const responses = {
      master: {
        message: "I understand you want help with that. Let me route you to the best specialist agent for your request.",
        metadata: { handledBy: 'master-agent' }
      },
      utility: {
        message: content.toLowerCase().includes('event') 
          ? "I'd be happy to help you plan an event! Please provide details like the event title, date, location, and participants."
          : content.toLowerCase().includes('payment') || content.toLowerCase().includes('split')
          ? "I can help you split payments! Let me know the total amount, currency, and participants."
          : "I can help you with event planning, payment splitting, expense tracking, and group coordination. What would you like to do?",
        metadata: { handledBy: 'utility-agent' }
      },
      trading: {
        message: content.toLowerCase().includes('portfolio') || content.toLowerCase().includes('balance')
          ? "Let me fetch your portfolio information. I'll show your token balances, total value, and performance metrics."
          : content.toLowerCase().includes('trade') || content.toLowerCase().includes('swap')
          ? "I can help you execute trades on Base! Please specify which tokens you'd like to swap and the amount."
          : content.toLowerCase().includes('price')
          ? "I can provide real-time token prices and set up price alerts for you. Which token would you like to check?"
          : "I can help you with trading, portfolio management, price monitoring, and market analysis. What would you like to do?",
        metadata: { handledBy: 'trading-agent' },
        actions: content.toLowerCase().includes('trade') ? [{ type: 'transaction', payload: { requiresApproval: true } }] : undefined
      },
      gaming: {
        message: content.toLowerCase().includes('game') || content.toLowerCase().includes('play')
          ? "Let's start a game! Available games: Trivia Quiz, Word Chain, Number Guessing, Crypto Prediction. Which game would you like to play?"
          : content.toLowerCase().includes('bet')
          ? "Ready to place a bet? Tell me the game, amount, and what you're betting on!"
          : "I can start interactive games, manage tournaments, and handle betting. What sounds fun?",
        metadata: { handledBy: 'game-agent' }
      },
      social: {
        message: content.toLowerCase().includes('news')
          ? "🔥 **Latest Crypto News:**\n\n📰 **Bitcoin Reaches New All-Time High**\nBitcoin surpasses $100,000 as institutional adoption continues...\n\n📰 **Base Network Surpasses 1 Million Daily Users**\nCoinbase Layer 2 solution shows strong growth metrics..."
          : content.toLowerCase().includes('trending')
          ? "📈 **Trending Topics in Crypto:**\n\n1. Base Network Growth\n2. Bitcoin ETF\n3. DeFi Yield Farming\n4. NFT Gaming\n5. Layer 2 Scaling"
          : "I can curate crypto news, show trending topics, analyze sentiment, and provide personalized content. What interests you?",
        metadata: { handledBy: 'social-agent' }
      },
      miniapp: {
        message: content.toLowerCase().includes('calculate')
          ? "🧮 I can help you with calculations! Try asking 'calculate 2 + 2' or launch the Calculator app."
          : content.toLowerCase().includes('convert')
          ? "💱 I can convert between currencies and cryptocurrencies! Try 'convert 100 USD to ETH' or launch the Currency Converter app."
          : content.toLowerCase().includes('poll')
          ? "📊 I can create polls for group decisions! Try 'create poll: What should we do tonight?' or launch the Poll Creator app."
          : "🚀 **Available Mini-Apps:**\n\n🧮 **Calculator**: Mathematical calculations\n💱 **Currency Converter**: Fiat and crypto conversion\n📊 **Poll Creator**: Group voting and surveys\n\nWhich app would you like to launch?",
        metadata: { handledBy: 'miniapp-agent' }
      }
    };

    return responses[agent as keyof typeof responses] || responses.master;
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
                {isConnected ? 'Connected via XMTP' : 'Connecting...'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-xs text-gray-500">
              {isConnected ? 'Online' : 'Connecting'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions 
        selectedAgent={selectedAgent}
        onActionSelect={handleQuickAction}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <MessageList messages={messages} />
        {isTyping && <AgentTyping agentName={selectedAgent} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200">
        <MessageInput 
          onSendMessage={handleSendMessage}
          disabled={!walletAddress}
          placeholder={
            !walletAddress 
              ? "Connect your wallet to start chatting..." 
              : `Message ${selectedAgent}Agent...`
          }
        />
      </div>
    </div>
  );
}
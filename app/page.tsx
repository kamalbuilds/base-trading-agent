'use client';

import { useState, useEffect } from 'react';
import { ChatInterface } from '../components/chat/ChatInterface';
import { AgentSelector } from '../components/agents/AgentSelector';
import { SystemStatus } from '../components/system/SystemStatus';
import { WalletConnection } from '../components/wallet/WalletConnection';
import { ConversationList } from '../components/conversations/ConversationList';
import { ConnectWallet } from '@/components/wallet/ConnectWallet';

export default function Home() {
  const [selectedAgent, setSelectedAgent] = useState<string>('master');
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [activeConversation, setActiveConversation] = useState<string>('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">BA</span>
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  BaseAgents
                </h1>
              </div>
              <div className="hidden md:block">
                <span className="text-sm text-gray-500">Multi-Agent System for Base</span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <SystemStatus />
              {/* <WalletConnection
                onConnect={setWalletAddress}
                onDisconnect={() => setWalletAddress('')}
              /> */}
              <ConnectWallet />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-8rem)]">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Agent Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Agent</h2>
              <AgentSelector
                selectedAgent={selectedAgent}
                onAgentSelect={setSelectedAgent}
              />
            </div>

            {/* Conversations */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversations</h2>
              <ConversationList
                activeConversation={activeConversation}
                onConversationSelect={setActiveConversation}
              />
            </div>
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-3">
            <ChatInterface
              selectedAgent={selectedAgent}
              walletAddress={walletAddress}
              conversationId={activeConversation}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
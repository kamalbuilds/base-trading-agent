'use client';

import { useState, useEffect } from 'react';
import { ChatBubbleLeftRightIcon, UserGroupIcon, UserIcon } from '@heroicons/react/24/outline';

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  participants: string[];
  isGroup: boolean;
  unreadCount: number;
}

interface ConversationListProps {
  activeConversation: string;
  onConversationSelect: (conversationId: string) => void;
}

export function ConversationList({ activeConversation, onConversationSelect }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    // Mock conversations data
    const mockConversations: Conversation[] = [
      {
        id: 'conv-1',
        title: 'Trading Discussion',
        lastMessage: 'What\'s the best time to buy ETH?',
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        participants: ['0x1234...5678', '0xabcd...efgh'],
        isGroup: false,
        unreadCount: 2
      },
      {
        id: 'conv-2',
        title: 'Game Night Planning',
        lastMessage: 'Let\'s start with trivia!',
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        participants: ['0x1234...5678', '0xabcd...efgh', '0x9876...5432'],
        isGroup: true,
        unreadCount: 0
      },
      {
        id: 'conv-3',
        title: 'DeFi Strategy Group',
        lastMessage: 'Check out this new yield farm',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        participants: ['0x1234...5678', '0xabcd...efgh', '0x9876...5432', '0xfedc...ba98'],
        isGroup: true,
        unreadCount: 1
      }
    ];
    
    setConversations(mockConversations);
  }, []);

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    
    if (diff < 60 * 1000) {
      return 'Just now';
    } else if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 1000))}m ago`;
    } else if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
    } else {
      return timestamp.toLocaleDateString();
    }
  };

  return (
    <div className="space-y-2">
      {conversations.length === 0 ? (
        <div className="text-center py-8">
          <ChatBubbleLeftRightIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No conversations yet</p>
          <p className="text-gray-400 text-xs mt-1">
            Connect your wallet to start chatting
          </p>
        </div>
      ) : (
        conversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => onConversationSelect(conversation.id)}
            className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
              activeConversation === conversation.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-1">
                {conversation.isGroup ? (
                  <UserGroupIcon className="w-5 h-5 text-gray-400" />
                ) : (
                  <UserIcon className="w-5 h-5 text-gray-400" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-gray-900 truncate">
                    {conversation.title}
                  </h4>
                  {conversation.unreadCount > 0 && (
                    <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-gray-500 truncate mb-1">
                  {conversation.lastMessage}
                </p>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {formatTimestamp(conversation.timestamp)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {conversation.participants.length} participant{conversation.participants.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  );
}
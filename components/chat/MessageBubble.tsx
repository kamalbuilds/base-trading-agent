'use client';

import { Message } from './types';
import { ActionButtons } from './ActionButtons';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {!isUser && (
          <div className="flex items-center space-x-2 mb-1">
            <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-semibold">
                {message.agentName?.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-xs text-gray-500 capitalize">
              {message.agentName}Agent
            </span>
            <span className="text-xs text-gray-400">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
        )}
        
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
              : 'bg-gray-100 text-gray-900'
          }`}
        >
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
          
          {message.actions && message.actions.length > 0 && (
            <div className="mt-3">
              <ActionButtons actions={message.actions} />
            </div>
          )}
        </div>
        
        {isUser && (
          <div className="text-xs text-gray-400 text-right mt-1">
            {message.timestamp.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
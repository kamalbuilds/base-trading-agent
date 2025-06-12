'use client';

import { useState, KeyboardEvent } from 'react';
import { PaperAirplaneIcon, PaperClipIcon } from '@heroicons/react/24/outline';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({ onSendMessage, disabled, placeholder }: MessageInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end space-x-3">
      <div className="flex-1 relative">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder || "Type your message..."}
          disabled={disabled}
          rows={1}
          className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 pr-12 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          style={{ minHeight: '48px', maxHeight: '120px' }}
        />
        <button
          type="button"
          className="absolute right-2 bottom-2 p-1 text-gray-400 hover:text-gray-600"
        >
          <PaperClipIcon className="w-5 h-5" />
        </button>
      </div>
      
      <button
        onClick={handleSend}
        disabled={!message.trim() || disabled}
        className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl p-3 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      >
        <PaperAirplaneIcon className="w-5 h-5" />
      </button>
    </div>
  );
}
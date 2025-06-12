'use client';

import { useState } from 'react';
import { WalletIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface WalletConnectionProps {
  onConnect: (address: string) => void;
  onDisconnect: () => void;
}

export function WalletConnection({ onConnect, onDisconnect }: WalletConnectionProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const connectWallet = async () => {
    setIsConnecting(true);
    
    try {
      // Simulate wallet connection
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock wallet address
      const mockAddress = '0x1234...5678';
      setAddress(mockAddress);
      setIsConnected(true);
      onConnect(mockAddress);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setAddress('');
    setShowDropdown(false);
    onDisconnect();
  };

  if (!isConnected) {
    return (
      <button
        onClick={connectWallet}
        disabled={isConnecting}
        className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
      >
        <WalletIcon className="w-5 h-5" />
        <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="bg-white border border-gray-200 hover:border-gray-300 text-gray-900 px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2"
      >
        <div className="w-2 h-2 bg-green-500 rounded-full" />
        <span className="hidden sm:inline">{address}</span>
        <span className="sm:hidden">Connected</span>
        <ChevronDownIcon className="w-4 h-4" />
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Connected Wallet</p>
              <p className="font-mono text-sm text-gray-900 break-all">{address}</p>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Network</span>
              <span className="text-sm text-gray-900">Base Mainnet</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Balance</span>
              <span className="text-sm text-gray-900">2.5 ETH</span>
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-gray-200">
            <button
              onClick={disconnectWallet}
              className="w-full text-left text-sm text-red-600 hover:text-red-700 transition-colors"
            >
              Disconnect Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
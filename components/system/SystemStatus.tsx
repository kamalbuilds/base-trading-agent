'use client';

import { useState } from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon, PlayIcon, StopIcon } from '@heroicons/react/24/outline';
import { useAgents } from '../../hooks/useAgents';

export function SystemStatus() {
  const [showDetails, setShowDetails] = useState(false);
  const { 
    isServerRunning, 
    health, 
    isLoading, 
    error, 
    startAgents, 
    stopAgents, 
    clearError 
  } = useAgents();

  const getStatusIcon = () => {
    if (isLoading) {
      return <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
    }

    switch (health?.status) {
      case 'healthy':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      default:
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusText = () => {
    if (isLoading) return 'Checking...';
    
    switch (health?.status) {
      case 'healthy':
        return 'All Systems Operational';
      case 'degraded':
        return 'Degraded Performance';
      default:
        return 'System Offline';
    }
  };

  const handleToggleServer = async () => {
    if (isServerRunning) {
      await stopAgents();
    } else {
      await startAgents();
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        {getStatusIcon()}
        <span className="hidden sm:inline">{getStatusText()}</span>
      </button>

      {showDetails && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">System Status</h3>
            <button
              onClick={handleToggleServer}
              disabled={isLoading}
              className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                isServerRunning
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isServerRunning ? (
                <>
                  <StopIcon className="w-4 h-4" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4" />
                  <span>Start</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mb-3 p-2 bg-red-100 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={clearError}
                className="text-xs text-red-600 hover:text-red-800 underline"
              >
                Dismiss
              </button>
            </div>
          )}
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Agent Server</span>
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${
                  isServerRunning ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className={`text-sm ${
                  isServerRunning ? 'text-green-600' : 'text-red-600'
                }`}>
                  {isServerRunning ? 'Running' : 'Stopped'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">XMTP Connection</span>
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${
                  health?.xmtpConnected ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className={`text-sm ${
                  health?.xmtpConnected ? 'text-green-600' : 'text-red-600'
                }`}>
                  {health?.xmtpConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Base Network</span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm text-green-600">Online</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Active Agents</span>
              <span className="text-sm text-gray-900">
                {health?.agents ? Object.keys(health.agents).length : 0}/6
              </span>
            </div>
            
            {health?.uptime && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Uptime</span>
                <span className="text-sm text-gray-900">
                  {formatUptime(health.uptime)}
                </span>
              </div>
            )}
          </div>

          {health?.agents && Object.keys(health.agents).length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Agent Status</h4>
              <div className="space-y-1">
                {Object.entries(health.agents).map(([agentName, agentHealth]) => (
                  <div key={agentName} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{agentName}</span>
                    <div className="flex items-center space-x-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        agentHealth.status === 'healthy' ? 'bg-green-500' :
                        agentHealth.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <span className={`${
                        agentHealth.status === 'healthy' ? 'text-green-600' :
                        agentHealth.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {agentHealth.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="mt-4 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Last updated: {health?.lastHealthCheck ? 
                new Date(health.lastHealthCheck).toLocaleTimeString() : 
                'Never'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState, useEffect, useCallback } from 'react';

export interface AgentHealth {
  status: 'healthy' | 'degraded' | 'offline';
  uptime: number;
  messageCount: number;
  errorCount: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'offline';
  uptime: number;
  agents: Record<string, AgentHealth>;
  xmtpConnected: boolean;
  lastHealthCheck: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  agent: string;
  timestamp: string;
  actions?: Array<{
    type: string;
    label: string;
    description: string;
  }>;
}

export interface AgentState {
  isServerRunning: boolean;
  health: SystemHealth | null;
  isLoading: boolean;
  error: string | null;
  messages: ChatMessage[];
}

export function useAgents() {
  const [state, setState] = useState<AgentState>({
    isServerRunning: false,
    health: null,
    isLoading: false,
    error: null,
    messages: []
  });

  /**
   * Check agent server health
   */
  const checkHealth = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/agents');
      const data = await response.json();

      if (response.ok) {
        setState(prev => ({
          ...prev,
          isServerRunning: data.health?.status !== 'offline',
          health: data.health,
          isLoading: false
        }));
      } else {
        setState(prev => ({
          ...prev,
          isServerRunning: false,
          error: data.error || 'Failed to check agent status',
          isLoading: false
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isServerRunning: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false
      }));
    }
  }, []);

  /**
   * Start agent server
   */
  const startAgents = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' })
      });

      const data = await response.json();

      if (response.ok) {
        setState(prev => ({
          ...prev,
          isServerRunning: true,
          health: data.health,
          isLoading: false
        }));
        return { success: true, message: data.message };
      } else {
        setState(prev => ({
          ...prev,
          error: data.error || 'Failed to start agents',
          isLoading: false
        }));
        return { success: false, error: data.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
      return { success: false, error: errorMessage };
    }
  }, []);

  /**
   * Stop agent server
   */
  const stopAgents = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'stop' })
      });

      const data = await response.json();

      setState(prev => ({
        ...prev,
        isServerRunning: false,
        health: null,
        isLoading: false
      }));

      return { success: true, message: data.message };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
      return { success: false, error: errorMessage };
    }
  }, []);

  /**
   * Send message to agent
   */
  const sendMessage = useCallback(async (
    message: string, 
    agentType: string = 'master',
    conversationId?: string,
    walletAddress?: string
  ) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          agentType,
          conversationId,
          walletAddress
        })
      });

      const data = await response.json();

      if (response.ok) {
        const chatMessage: ChatMessage = {
          id: `msg_${Date.now()}`,
          text: data.response.text,
          agent: data.response.agent,
          timestamp: data.response.timestamp,
          actions: data.response.actions
        };

        setState(prev => ({
          ...prev,
          messages: [...prev.messages, chatMessage]
        }));

        return { success: true, message: chatMessage };
      } else {
        setState(prev => ({
          ...prev,
          error: data.error || 'Failed to send message'
        }));
        return { success: false, error: data.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        error: errorMessage
      }));
      return { success: false, error: errorMessage };
    }
  }, []);

  /**
   * Clear messages
   */
  const clearMessages = useCallback(() => {
    setState(prev => ({ ...prev, messages: [] }));
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * Auto-refresh health check
   */
  useEffect(() => {
    // Initial health check
    checkHealth();

    // Set up periodic health checks
    const interval = setInterval(checkHealth, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [checkHealth]);

  return {
    // State
    isServerRunning: state.isServerRunning,
    health: state.health,
    isLoading: state.isLoading,
    error: state.error,
    messages: state.messages,

    // Actions
    startAgents,
    stopAgents,
    sendMessage,
    checkHealth,
    clearMessages,
    clearError,
  };
} 
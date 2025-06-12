export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  agentName?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  actions?: any[];
}

export interface AgentAction {
  type: 'transaction' | 'miniapp' | 'notification' | 'data_request';
  payload: any;
  confirmation?: boolean;
}
import { DecodedMessage, Client as XMTPClient } from '@xmtp/browser-sdk';
import { Call } from 'viem';

// Core Agent Types
export interface BaseAgentConfig {
  name: string;
  description: string;
  capabilities: string[];
  version: string;
  isActive: boolean;
  priority: number;
}

export interface AgentContext {
  userId: string;
  conversationId: string;
  messageHistory: DecodedMessage[];
  userPreferences?: UserPreferences;
  agentMemory?: Record<string, any>;
}

export interface AgentResponse {
  message: string;
  actions?: AgentAction[];
  metadata?: Record<string, any>;
  requiresConfirmation?: boolean;
  nextAgent?: string;
}

export interface AgentAction {
  type: 'transaction' | 'miniapp' | 'notification' | 'data_request';
  payload: any;
  confirmation?: boolean;
}

// XMTP Message Types
export interface XMTPMessage {
  id: string;
  content: string;
  senderAddress: string;
  senderInboxId: string;
  conversationId: string;
  timestamp: Date;
  contentType?: string;
  metadata?: Record<string, any>;
}

export interface ConversationContext {
  id: string;
  participants: string[];
  isGroup: boolean;
  topic?: string;
  metadata?: Record<string, any>;
  lastActivity: Date;
  messageCount: number;
}

// Agent-Specific Types

// Master Agent
export interface MasterAgentConfig extends BaseAgentConfig {
  routingRules: RoutingRule[];
  fallbackAgent: string;
  maxConversations: number;
}

export interface RoutingRule {
  pattern: string | RegExp;
  agent: string;
  priority: number;
  conditions?: Record<string, any>;
}

// Utility Agent
export interface UtilityAgentConfig extends BaseAgentConfig {
  supportedTasks: UtilityTask[];
  maxParticipants: number;
  defaultCurrency: string;
}

export interface UtilityTask {
  type: 'event_planning' | 'payment_split' | 'shared_wallet' | 'expense_tracking';
  description: string;
  requiredParams: string[];
}

export interface EventPlan {
  id: string;
  title: string;
  description: string;
  dateTime: Date;
  location?: string;
  participants: string[];
  budget?: number;
  expenses: Expense[];
  status: 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  paidBy: string;
  sharedWith: string[];
  category: string;
  timestamp: Date;
}

export interface PaymentSplit {
  id: string;
  totalAmount: number;
  currency: string;
  participants: PaymentParticipant[];
  method: 'equal' | 'custom' | 'percentage';
  status: 'pending' | 'partial' | 'completed';
}

export interface PaymentParticipant {
  address: string;
  amount: number;
  paid: boolean;
  transactionHash?: string;
}

// Trading Agent
export interface TradingAgentConfig extends BaseAgentConfig {
  supportedNetworks: string[];
  maxTransactionValue: number;
  riskTolerance: 'low' | 'medium' | 'high';
  tradingPairs: string[];
}

export interface Portfolio {
  address: string;
  tokens: TokenBalance[];
  totalValue: number;
  lastUpdated: Date;
  performance: PerformanceMetrics;
}

export interface TokenBalance {
  symbol: string;
  address: string;
  balance: number;
  value: number;
  price: number;
  change24h: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  dailyChange: number;
  weeklyChange: number;
  monthlyChange: number;
  volatility: number;
}

export interface TradeRequest {
  fromToken: string;
  toToken: string;
  amount: number;
  slippage: number;
  deadline: number;
  userAddress: string;
}

export interface PriceAlert {
  id: string;
  tokenSymbol: string;
  condition: 'above' | 'below';
  targetPrice: number;
  isActive: boolean;
  createdBy: string;
}

// Gaming Agent
export interface GamingAgentConfig extends BaseAgentConfig {
  supportedGames: GameType[];
  maxPlayersPerGame: number;
  enableBetting: boolean;
}

export interface GameType {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  duration: number; // in minutes
  category: 'trivia' | 'word' | 'number' | 'strategy' | 'social';
}

export interface GameSession {
  id: string;
  gameType: string;
  players: GamePlayer[];
  status: 'waiting' | 'in_progress' | 'completed' | 'cancelled';
  currentRound: number;
  totalRounds: number;
  startTime: Date;
  endTime?: Date;
  winner?: string;
  scores: Record<string, number>;
  bets?: GameBet[];
}

export interface GamePlayer {
  address: string;
  displayName?: string;
  score: number;
  isActive: boolean;
  joinedAt: Date;
}

export interface GameBet {
  id: string;
  player: string;
  amount: number;
  currency: string;
  prediction: any;
  won?: boolean;
  payout?: number;
}

// Social Agent
export interface SocialAgentConfig extends BaseAgentConfig {
  contentSources: ContentSource[];
  moderationLevel: 'strict' | 'moderate' | 'lenient';
  personalizedContent: boolean;
}

export interface ContentSource {
  name: string;
  type: 'rss' | 'api' | 'blockchain' | 'social';
  url: string;
  categories: string[];
  isActive: boolean;
}

export interface CuratedContent {
  id: string;
  title: string;
  content: string;
  source: string;
  category: string;
  relevanceScore: number;
  timestamp: Date;
  engagementMetrics?: EngagementMetrics;
}

export interface EngagementMetrics {
  views: number;
  likes: number;
  shares: number;
  comments: number;
  clickThroughRate: number;
}

export interface UserPreferences {
  interests: string[];
  contentTypes: string[];
  frequency: 'high' | 'medium' | 'low';
  timeZone: string;
  language: string;
  notifications: NotificationPreferences;
}

export interface NotificationPreferences {
  priceAlerts: boolean;
  gameInvites: boolean;
  eventReminders: boolean;
  contentUpdates: boolean;
  systemUpdates: boolean;
}

// MiniApp Agent
export interface MiniAppAgentConfig extends BaseAgentConfig {
  supportedApps: MiniAppDefinition[];
  sandboxMode: boolean;
  maxAppsPerConversation: number;
}

export interface MiniAppDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  icon: string;
  category: string;
  permissions: string[];
  url: string;
  isActive: boolean;
}

export interface MiniAppSession {
  id: string;
  appId: string;
  conversationId: string;
  participants: string[];
  state: Record<string, any>;
  startTime: Date;
  lastActivity: Date;
  isActive: boolean;
}

// Blockchain Types
export interface TransactionRequest {
  to: string;
  value?: bigint;
  data?: string;
  gasLimit?: bigint;
  gasPrice?: bigint;
  nonce?: number;
}

export interface TransactionResult {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: bigint;
  error?: string;
}

export interface WalletBalance {
  address: string;
  balances: {
    [tokenAddress: string]: {
      balance: string;
      decimals: number;
      symbol: string;
      value?: number;
    };
  };
  totalValue: number;
  lastUpdated: Date;
}

// System Types
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  agents: Record<string, AgentHealth>;
  xmtpConnection: boolean;
  blockchainConnection: boolean;
  lastCheck: Date;
}

export interface AgentHealth {
  isActive: boolean;
  responseTime: number;
  errorRate: number;
  conversationCount: number;
  lastActivity: Date;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  source: string;
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Error Types
export class BaseAgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'BaseAgentError';
  }
}

export class XMTPError extends BaseAgentError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'XMTP_ERROR', metadata);
    this.name = 'XMTPError';
  }
}

export class BlockchainError extends BaseAgentError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'BLOCKCHAIN_ERROR', metadata);
    this.name = 'BlockchainError';
  }
}

export class AgentError extends BaseAgentError {
  constructor(message: string, agentName: string, metadata?: Record<string, any>) {
    super(message, 'AGENT_ERROR', { agentName, ...metadata });
    this.name = 'AgentError';
  }
} 
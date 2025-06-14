import dotenv from 'dotenv';
import winston from 'winston';
import { EventEmitter } from 'events';
import { MasterAgent } from './master-agent';
import { UtilityAgent } from './utility-agent';
import { TradingAgent } from './trading-agent';
import { GameAgent } from './game-agent';
import { SocialAgent } from './social-agent';
import { MiniAppAgent } from './miniapp-agent';
import { XMTPClientManager } from '../xmtp/client';
import {
  MasterAgentConfig,
  UtilityAgentConfig,
  TradingAgentConfig,
  GamingAgentConfig,
  SocialAgentConfig,
  MiniAppAgentConfig,
  AgentContext,
  SystemHealth,
  AgentHealth,
} from '../types';

// Load environment variables
dotenv.config();

/**
 * BasedAgents Server - Orchestrates the multi-agent system
 */
export class BaseAgentsServer extends EventEmitter {
  private logger: winston.Logger;
  private xmtpClient: XMTPClientManager;
  private masterAgent?: MasterAgent;
  private agents: Map<string, any> = new Map();
  private isRunning = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.logger = this.createLogger();
    this.xmtpClient = new XMTPClientManager();
    this.setupEventListeners();
  }

  /**
   * Initialize and start the agent server
   */
  async start(): Promise<void> {
    try {
      this.logger.info('🚀 Starting BasedAgents Server...');

      // Validate environment variables
      this.validateEnvironment();

      // Initialize XMTP client
      await this.xmtpClient.initialize();

      // Initialize all agents
      await this.initializeAgents();

      // Start XMTP message stream
      this.startMessageStream();

      // Start health monitoring
      this.startHealthMonitoring();

      this.isRunning = true;
      this.logger.info('✅ BasedAgents Server started successfully');
      this.emit('started');

    } catch (error) {
      this.logger.error('❌ Failed to start BasedAgents Server', { error });
      throw error;
    }
  }

  /**
   * Stop the agent server
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('🛑 Stopping BasedAgents Server...');

      this.isRunning = false;

      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Cleanup agents
      for (const agent of this.agents.values()) {
        await agent.cleanup();
      }

      // Cleanup XMTP client
      await this.xmtpClient.cleanup();

      this.logger.info('✅ BasedAgents Server stopped successfully');
      this.emit('stopped');

    } catch (error) {
      this.logger.error('❌ Error stopping BasedAgents Server', { error });
      throw error;
    }
  }

  /**
   * Validate required environment variables
   */
  private validateEnvironment(): void {
    const required = [
      'OPENAI_API_KEY',
      'WALLET_PRIVATE_KEY',
      'ENCRYPTION_KEY',
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    this.logger.info('✅ Environment validation passed');
  }

  /**
   * Initialize all agents and register with master agent
   */
  private async initializeAgents(): Promise<void> {
    this.logger.info('🤖 Initializing agents...');
    console.log('[BaseAgentsServer] Initializing agents...');

    try {
      // Initialize Master Agent
      console.log('[BaseAgentsServer] Initializing MasterAgent...');
      const masterConfig: MasterAgentConfig = {
        name: 'MasterAgent',
        description: 'Central orchestrator for the BasedAgents multi-agent system',
        capabilities: ['routing', 'delegation', 'system_management', 'agent_coordination'],
        version: '1.0.0',
        isActive: true,
        priority: 100,
        routingRules: [
          { pattern: /trade|swap|defi|portfolio/i, agent: 'TradingAgent', priority: 90 },
          { pattern: /game|play|bet|trivia/i, agent: 'GameAgent', priority: 80 },
          { pattern: /event|plan|payment|split/i, agent: 'UtilityAgent', priority: 85 },
          { pattern: /news|social|content|trending/i, agent: 'SocialAgent', priority: 75 },
          { pattern: /app|tool|calculate|convert/i, agent: 'MiniAppAgent', priority: 70 },
        ],
        fallbackAgent: 'UtilityAgent',
        maxConversations: 1000,
      };
      this.masterAgent = new MasterAgent(masterConfig);
      await this.masterAgent.initialize();
      this.agents.set('MasterAgent', this.masterAgent);
      console.log('[BaseAgentsServer] MasterAgent initialized and registered.');

      // Initialize Utility Agent
      console.log('[BaseAgentsServer] Initializing UtilityAgent...');
      const utilityConfig: UtilityAgentConfig = {
        name: 'UtilityAgent',
        description: 'Handles event planning, payment splitting, and group coordination',
        capabilities: ['event_planning', 'payment_splitting', 'expense_tracking', 'shared_wallets'],
        version: '1.0.0',
        isActive: true,
        priority: 85,
        supportedTasks: [
          { type: 'event_planning', description: 'Organize events with participants', requiredParams: ['title', 'date'] },
          { type: 'payment_split', description: 'Split payments among group members', requiredParams: ['amount', 'participants'] },
          { type: 'shared_wallet', description: 'Manage shared group wallets', requiredParams: ['participants'] },
          { type: 'expense_tracking', description: 'Track group expenses', requiredParams: ['description', 'amount'] },
        ],
        maxParticipants: 50,
        defaultCurrency: 'USDC',
      };
      const utilityAgent = new UtilityAgent(utilityConfig);
      await utilityAgent.initialize();
      await this.masterAgent.registerAgent(utilityAgent);
      this.agents.set('UtilityAgent', utilityAgent);
      console.log('[BaseAgentsServer] UtilityAgent initialized and registered.');

      // Initialize Trading Agent
      console.log('[BaseAgentsServer] Initializing TradingAgent...');
      const tradingConfig: TradingAgentConfig = {
        name: 'TradingAgent',
        description: 'Handles DeFi operations, trading, and portfolio management',
        capabilities: ['token_swaps', 'portfolio_tracking', 'price_alerts', 'market_analysis'],
        version: '1.0.0',
        isActive: true,
        priority: 90,
        supportedNetworks: ['base-mainnet', 'ethereum'],
        maxTransactionValue: 100000, // $100k USD
        riskTolerance: 'medium',
        tradingPairs: ['ETH/USDC', 'BTC/USDC', 'USDC/DAI'],
      };
      const tradingAgent = new TradingAgent(tradingConfig);
      await tradingAgent.initialize();
      await this.masterAgent.registerAgent(tradingAgent);
      this.agents.set('TradingAgent', tradingAgent);
      console.log('[BaseAgentsServer] TradingAgent initialized and registered.');

      // Initialize Game Agent
      console.log('[BaseAgentsServer] Initializing GameAgent...');
      const gameConfig: GamingAgentConfig = {
        name: 'GameAgent',
        description: 'Manages interactive multiplayer games and entertainment',
        capabilities: ['trivia_games', 'word_games', 'betting', 'tournaments'],
        version: '1.0.0',
        isActive: true,
        priority: 80,
        supportedGames: [
          { id: 'trivia', name: 'Trivia Quiz', description: 'Answer questions to earn points', minPlayers: 2, maxPlayers: 10, duration: 15, category: 'trivia' },
          { id: 'word-chain', name: 'Word Chain', description: 'Build words from previous letters', minPlayers: 2, maxPlayers: 6, duration: 10, category: 'word' },
        ],
        maxPlayersPerGame: 20,
        enableBetting: true,
      };
      const gameAgent = new GameAgent(gameConfig);
      await gameAgent.initialize();
      await this.masterAgent.registerAgent(gameAgent);
      this.agents.set('GameAgent', gameAgent);
      console.log('[BaseAgentsServer] GameAgent initialized and registered.');

      // Initialize Social Agent
      console.log('[BaseAgentsServer] Initializing SocialAgent...');
      const socialConfig: SocialAgentConfig = {
        name: 'SocialAgent',
        description: 'Curates content and manages community engagement',
        capabilities: ['content_curation', 'news_aggregation', 'sentiment_analysis', 'trending_topics'],
        version: '1.0.0',
        isActive: true,
        priority: 75,
        contentSources: [
          { name: 'CoinDesk', type: 'rss', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', categories: ['bitcoin'], isActive: true },
          { name: 'CoinTelegraph', type: 'rss', url: 'https://cointelegraph.com/rss', categories: ['altcoins'], isActive: true },
        ],
        moderationLevel: 'moderate',
        personalizedContent: true,
      };
      const socialAgent = new SocialAgent(socialConfig);
      await socialAgent.initialize();
      await this.masterAgent.registerAgent(socialAgent);
      this.agents.set('SocialAgent', socialAgent);
      console.log('[BaseAgentsServer] SocialAgent initialized and registered.');

      // Initialize MiniApp Agent
      console.log('[BaseAgentsServer] Initializing MiniAppAgent...');
      const miniappConfig: MiniAppAgentConfig = {
        name: 'MiniAppAgent',
        description: 'Launches and manages mini-applications within conversations',
        capabilities: ['app_management', 'utility_tools', 'calculator', 'converter', 'polls'],
        version: '1.0.0',
        isActive: true,
        priority: 70,
        supportedApps: [
          { id: 'calculator', name: 'Calculator', description: 'Mathematical calculations', version: '1.0.0', icon: '🧮', category: 'utility', permissions: [], url: '/apps/calculator', isActive: true },
          { id: 'converter', name: 'Currency Converter', description: 'Convert currencies', version: '1.0.0', icon: '💱', category: 'finance', permissions: [], url: '/apps/converter', isActive: true },
        ],
        sandboxMode: false,
        maxAppsPerConversation: 5,
      };
      const miniappAgent = new MiniAppAgent(miniappConfig);
      await miniappAgent.initialize();
      await this.masterAgent.registerAgent(miniappAgent);
      this.agents.set('MiniAppAgent', miniappAgent);
      console.log('[BaseAgentsServer] MiniAppAgent initialized and registered.');

      console.log(`[BaseAgentsServer] All agents initialized. Total: ${this.agents.size}`);
      this.logger.info(`✅ Initialized ${this.agents.size} agents successfully`);

    } catch (error) {
      this.logger.error('❌ Failed to initialize agents', { error });
      console.error('[BaseAgentsServer] Failed to initialize agents:', error);
      throw error;
    }
  }

  /**
   * Start listening for XMTP messages
   */
  private startMessageStream(): void {
    this.logger.info('📡 Starting XMTP message stream...');
    
    // Start the message stream in the background
    this.xmtpClient.startMessageStream().catch(error => {
      this.logger.error('Message stream error', { error });
      this.emit('error', error);
    });
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // XMTP Client Events
    this.xmtpClient.on('connected', (data) => {
      this.logger.info('XMTP client connected', data);
    });

    this.xmtpClient.on('messageReceived', async (message) => {
      await this.handleIncomingMessage(message);
    });

    this.xmtpClient.on('error', (error) => {
      this.logger.error('XMTP client error', { error });
      this.emit('error', error);
    });

    // Agent Events
    this.on('agentActivity', (data) => {
      this.logger.debug('Agent activity', data);
    });

    this.on('agentError', (data) => {
      this.logger.error('Agent error', data);
    });

    // Process termination handlers
    process.on('SIGINT', this.gracefulShutdown.bind(this));
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', { error });
      this.gracefulShutdown();
    });
  }

  /**
   * Handle incoming XMTP messages
   */
  private async handleIncomingMessage(message: any): Promise<void> {
    try {
      if (!this.masterAgent) {
        this.logger.error('Master agent not initialized');
        return;
      }

      this.logger.info('Processing incoming message', {
        messageId: message.id,
        senderInboxId: message.senderInboxId,
        conversationId: message.conversationId,
        contentLength: message.content.length,
      });

      // Create agent context
      const context: AgentContext = {
        userId: message.senderInboxId,
        conversationId: message.conversationId,
        messageHistory: [message], // In production, would fetch conversation history
        userPreferences: undefined, // Would fetch from database
        agentMemory: {},
      };

      // Process message with master agent
      const response = await this.masterAgent.processMessage(message, context);

      // Send response back via XMTP
      if (response.message) {
        await this.xmtpClient.sendMessage(message.conversationId, response.message);
      }

      // Handle any required actions
      if (response.actions) {
        await this.handleAgentActions(response.actions, context);
      }

      this.logger.info('Message processed successfully', {
        messageId: message.id,
        responseLength: response.message.length,
        handledBy: response.metadata?.handledBy,
      });

    } catch (error) {
      this.logger.error('Error processing message', { error, messageId: message.id });
      
      // Send error response to user
      try {
        await this.xmtpClient.sendMessage(
          message.conversationId,
          '❌ Sorry, I encountered an error processing your message. Please try again.'
        );
      } catch (sendError) {
        this.logger.error('Failed to send error message', { sendError });
      }
    }
  }

  /**
   * Handle agent actions (transactions, notifications, etc.)
   */
  private async handleAgentActions(actions: any[], context: AgentContext): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'transaction':
            await this.handleTransactionAction(action, context);
            break;
          case 'notification':
            await this.handleNotificationAction(action, context);
            break;
          case 'miniapp':
            await this.handleMiniappAction(action, context);
            break;
          default:
            this.logger.warn('Unknown action type', { actionType: action.type });
        }
      } catch (error) {
        this.logger.error('Error handling agent action', { error, action });
      }
    }
  }

  private async handleTransactionAction(action: any, context: AgentContext): Promise<void> {
    this.logger.info('Handling transaction action', { action, userId: context.userId });
    // Implementation would handle blockchain transactions
  }

  private async handleNotificationAction(action: any, context: AgentContext): Promise<void> {
    this.logger.info('Handling notification action', { action, userId: context.userId });
    // Implementation would send notifications
  }

  private async handleMiniappAction(action: any, context: AgentContext): Promise<void> {
    this.logger.info('Handling miniapp action', { action, userId: context.userId });
    // Implementation would launch mini-apps
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Perform system health check
   */
  private performHealthCheck(): void {
    try {
      const health = this.getSystemHealth();
      
      if (health.status !== 'healthy') {
        this.logger.warn('System health degraded', { health });
        this.emit('healthDegraded', health);
      }

      this.emit('healthCheck', health);
    } catch (error) {
      this.logger.error('Health check failed', { error });
    }
  }

  /**
   * Get system health status
   */
  public getSystemHealth(): SystemHealth {
    const agentHealth: Record<string, AgentHealth> = {};
    
    for (const [name, agent] of this.agents) {
      const health = agent.getHealth();
      agentHealth[name] = {
        isActive: health.isActive,
        responseTime: 0, // Would track actual response times
        errorRate: 0, // Would track error rates
        conversationCount: health.conversationCount,
        lastActivity: health.lastActivity,
      };
    }

    const xmtpStatus = this.xmtpClient.getStatus();
    const overallStatus = this.isRunning && xmtpStatus.isConnected ? 'healthy' : 'degraded';

    return {
      status: overallStatus,
      agents: agentHealth,
      xmtpConnection: xmtpStatus.isConnected,
      blockchainConnection: true, // Would check actual blockchain connection
      lastCheck: new Date(),
    };
  }

  /**
   * Graceful shutdown handler
   */
  private async gracefulShutdown(): Promise<void> {
    this.logger.info('Initiating graceful shutdown...');
    
    try {
      await this.stop();
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  }

  /**
   * Create logger instance
   */
  private createLogger(): winston.Logger {
    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'base-agents-server' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        new winston.transports.File({
          filename: 'logs/server-error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/server.log',
        }),
      ],
    });
  }

  /**
   * Get an agent by type/name
   */
  public getAgent(agentType: string): any {
    return this.agents.get(agentType);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new BaseAgentsServer();
  
  server.start().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default BaseAgentsServer; 
// NOTE: This agent is ready for EVM wallet management with CdpV2EvmWalletProvider (Coinbase AgentKit v2)
import { DecodedMessage } from '@xmtp/browser-sdk';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseAgent } from './base-agent';
import { v4 as uuidv4 } from 'uuid';
import { CdpV2EvmWalletProvider } from '@coinbase/agentkit';
import {
  MiniAppAgentConfig,
  AgentContext,
  AgentResponse,
  MiniAppDefinition,
  MiniAppSession,
} from '../types';

/**
 * MiniAppAgent handles launching and managing mini-applications within conversations
 */
export class MiniAppAgent extends BaseAgent {
  private availableApps: Map<string, MiniAppDefinition> = new Map();
  private activeSessions: Map<string, MiniAppSession> = new Map();
  private userSessions: Map<string, string[]> = new Map(); // userId -> sessionIds

  constructor(config: MiniAppAgentConfig) {
    super(config);
    this.initializeApps();
  }

  protected initializeTools(): void {
    this.tools.push(
      new DynamicStructuredTool({
        name: 'list_apps',
        description: 'List all available mini-applications',
        schema: z.object({
          category: z.string().optional(),
        }),
        func: async ({ category }) => {
          const apps = await this.listApps(category);
          return `Available apps: ${apps.map(a => a.name).join(', ')}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'launch_app',
        description: 'Launch a mini-application in the conversation',
        schema: z.object({
          appId: z.string(),
          conversationId: z.string(),
          participants: z.array(z.string()),
          initialState: z.record(z.any()).optional(),
        }),
        func: async ({ appId, conversationId, participants, initialState }) => {
          const session = await this.launchApp(appId, conversationId, participants, initialState);
          return `Launched ${session.appId} - Session ID: ${session.id}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'interact_with_app',
        description: 'Interact with an active mini-app session',
        schema: z.object({
          sessionId: z.string(),
          userId: z.string(),
          action: z.string(),
          data: z.record(z.any()).optional(),
        }),
        func: async ({ sessionId, userId, action, data }) => {
          const result = await this.interactWithApp(sessionId, userId, action, data);
          return `App interaction: ${result.message}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'close_app',
        description: 'Close an active mini-app session',
        schema: z.object({
          sessionId: z.string(),
          userId: z.string(),
        }),
        func: async ({ sessionId, userId }) => {
          await this.closeApp(sessionId, userId);
          return `App session ${sessionId} closed`;
        },
      }),

      new DynamicStructuredTool({
        name: 'get_app_state',
        description: 'Get current state of an active mini-app',
        schema: z.object({
          sessionId: z.string(),
        }),
        func: async ({ sessionId }) => {
          const state = await this.getAppState(sessionId);
          return `App state: ${JSON.stringify(state)}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'calculate',
        description: 'Perform mathematical calculations',
        schema: z.object({
          expression: z.string(),
        }),
        func: async ({ expression }) => {
          const result = await this.calculate(expression);
          return `${expression} = ${result}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'convert_currency',
        description: 'Convert between different currencies or cryptocurrencies',
        schema: z.object({
          amount: z.number(),
          from: z.string(),
          to: z.string(),
        }),
        func: async ({ amount, from, to }) => {
          const result = await this.convertCurrency(amount, from, to);
          return `${amount} ${from} = ${result.amount} ${to} (Rate: ${result.rate})`;
        },
      }),

      new DynamicStructuredTool({
        name: 'create_poll',
        description: 'Create a poll within the conversation',
        schema: z.object({
          question: z.string(),
          options: z.array(z.string()),
          conversationId: z.string(),
        }),
        func: async ({ question, options, conversationId }) => {
          const poll = await this.createPoll(question, options, conversationId);
          return `Poll created: "${question}" with ${options.length} options`;
        },
      })
    );
  }

  protected async handleMessage(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    const content = typeof message.content === 'string' ? message.content.toLowerCase() : '';

    if (this.isAppRequest(content)) {
      return await this.handleAppRequest(message, context);
    } else if (this.isCalculationRequest(content)) {
      return await this.handleCalculation(message, context);
    } else if (this.isConversionRequest(content)) {
      return await this.handleConversion(message, context);
    } else if (this.isPollRequest(content)) {
      return await this.handlePoll(message, context);
    }

    // Process with LLM for complex tool requests
    const response = await this.processWithLLM(typeof message.content === 'string' ? message.content : '', context);

    return {
      message: response,
      metadata: { handledBy: 'miniapp-agent' }
    };
  }

  protected async shouldHandleMessage(message: DecodedMessage, context: AgentContext): Promise<boolean> {
    const content = typeof message.content === 'string' ? message.content.toLowerCase() : '';
    const miniappKeywords = [
      'app', 'tool', 'launch', 'open', 'calculate', 'convert', 'poll', 
      'calculator', 'converter', 'utility', 'mini-app', 'miniapp'
    ];
    
    return miniappKeywords.some(keyword => content.includes(keyword));
  }

  protected async suggestNextAgent(message: DecodedMessage, context: AgentContext): Promise<string> {
    const content = typeof message.content === 'string' ? message.content.toLowerCase() : '';
    
    if (content.includes('trade') || content.includes('defi')) return 'trading';
    if (content.includes('game') || content.includes('play')) return 'gaming';
    if (content.includes('event') || content.includes('payment')) return 'utility';
    if (content.includes('news') || content.includes('social')) return 'social';
    
    return 'master';
  }

  private initializeApps(): void {
    const apps: MiniAppDefinition[] = [
      {
        id: 'calculator',
        name: 'Calculator',
        description: 'Perform mathematical calculations',
        version: '1.0.0',
        icon: '🧮',
        category: 'utility',
        permissions: [],
        url: '/apps/calculator',
        isActive: true,
      },
      {
        id: 'currency-converter',
        name: 'Currency Converter',
        description: 'Convert between fiat and cryptocurrencies',
        version: '1.0.0',
        icon: '💱',
        category: 'finance',
        permissions: ['price_data'],
        url: '/apps/converter',
        isActive: true,
      },
      {
        id: 'poll-creator',
        name: 'Poll Creator',
        description: 'Create polls and surveys for group decisions',
        version: '1.0.0',
        icon: '📊',
        category: 'social',
        permissions: ['group_messaging'],
        url: '/apps/polls',
        isActive: true,
      },
      {
        id: 'expense-tracker',
        name: 'Expense Tracker',
        description: 'Track and split expenses among group members',
        version: '1.0.0',
        icon: '💰',
        category: 'finance',
        permissions: ['group_data', 'payments'],
        url: '/apps/expenses',
        isActive: true,
      },
      {
        id: 'token-scanner',
        name: 'Token Scanner',
        description: 'Scan and analyze token contracts and safety',
        version: '1.0.0',
        icon: '🔍',
        category: 'defi',
        permissions: ['blockchain_data'],
        url: '/apps/scanner',
        isActive: true,
      },
      {
        id: 'nft-viewer',
        name: 'NFT Viewer',
        description: 'View and share NFT collections',
        version: '1.0.0',
        icon: '🎨',
        category: 'nft',
        permissions: ['blockchain_data'],
        url: '/apps/nfts',
        isActive: true,
      },
    ];

    apps.forEach(app => this.availableApps.set(app.id, app));
  }

  private async listApps(category?: string): Promise<MiniAppDefinition[]> {
    const allApps = Array.from(this.availableApps.values()).filter(app => app.isActive);
    
    if (category) {
      return allApps.filter(app => app.category === category);
    }
    
    return allApps;
  }

  private async launchApp(
    appId: string, 
    conversationId: string, 
    participants: string[], 
    initialState?: Record<string, any>
  ): Promise<MiniAppSession> {
    const app = this.availableApps.get(appId);
    if (!app) {
      throw new Error(`App ${appId} not found`);
    }

    const session: MiniAppSession = {
      id: uuidv4(),
      appId,
      conversationId,
      participants,
      state: initialState || {},
      startTime: new Date(),
      lastActivity: new Date(),
      isActive: true,
    };

    this.activeSessions.set(session.id, session);
    
    // Track user sessions
    participants.forEach(userId => {
      const userSessions = this.userSessions.get(userId) || [];
      userSessions.push(session.id);
      this.userSessions.set(userId, userSessions);
    });

    this.logger.info('Mini-app launched', { 
      sessionId: session.id, 
      appId, 
      conversationId,
      participants: participants.length 
    });

    return session;
  }

  private async interactWithApp(
    sessionId: string, 
    userId: string, 
    action: string, 
    data?: Record<string, any>
  ): Promise<{ success: boolean; message: string; newState?: Record<string, any> }> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return { success: false, message: 'Session not found' };
    }

    if (!session.participants.includes(userId)) {
      return { success: false, message: 'User not authorized for this session' };
    }

    const app = this.availableApps.get(session.appId);
    if (!app) {
      return { success: false, message: 'App not found' };
    }

    // Process app-specific interactions
    const result = await this.processAppInteraction(session, userId, action, data);
    
    // Update session
    session.lastActivity = new Date();
    session.state = { ...session.state, ...result.newState };
    this.activeSessions.set(sessionId, session);

    return result;
  }

  private async processAppInteraction(
    session: MiniAppSession, 
    userId: string, 
    action: string, 
    data?: Record<string, any>
  ): Promise<{ success: boolean; message: string; newState?: Record<string, any> }> {
    switch (session.appId) {
      case 'calculator':
        return this.handleCalculatorInteraction(session, action, data);
      case 'currency-converter':
        return this.handleConverterInteraction(session, action, data);
      case 'poll-creator':
        return this.handlePollInteraction(session, userId, action, data);
      default:
        return { success: false, message: 'Unknown app interaction' };
    }
  }

  private handleCalculatorInteraction(
    session: MiniAppSession, 
    action: string, 
    data?: Record<string, any>
  ): { success: boolean; message: string; newState?: Record<string, any> } {
    if (action === 'calculate' && data?.expression) {
      try {
        const result = this.evaluateExpression(data.expression);
        return {
          success: true,
          message: `${data.expression} = ${result}`,
          newState: { lastCalculation: { expression: data.expression, result } }
        };
      } catch (error) {
        return { success: false, message: 'Invalid expression' };
      }
    }
    
    return { success: false, message: 'Invalid calculator action' };
  }

  private handleConverterInteraction(
    session: MiniAppSession, 
    action: string, 
    data?: Record<string, any>
  ): { success: boolean; message: string; newState?: Record<string, any> } {
    if (action === 'convert' && data?.amount && data?.from && data?.to) {
      // Mock conversion rate - in production would use real API
      const rate = this.getMockConversionRate(data.from, data.to);
      const result = data.amount * rate;
      
      return {
        success: true,
        message: `${data.amount} ${data.from} = ${result.toFixed(4)} ${data.to}`,
        newState: { lastConversion: { amount: data.amount, from: data.from, to: data.to, result, rate } }
      };
    }
    
    return { success: false, message: 'Invalid conversion parameters' };
  }

  private handlePollInteraction(
    session: MiniAppSession, 
    userId: string, 
    action: string, 
    data?: Record<string, any>
  ): { success: boolean; message: string; newState?: Record<string, any> } {
    if (action === 'vote' && data?.option !== undefined) {
      const votes = session.state.votes || {};
      votes[userId] = data.option;
      
      return {
        success: true,
        message: `Vote recorded for option ${data.option}`,
        newState: { votes }
      };
    }
    
    return { success: false, message: 'Invalid poll action' };
  }

  private async closeApp(sessionId: string, userId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (!session.participants.includes(userId)) {
      throw new Error('User not authorized to close this session');
    }

    session.isActive = false;
    this.activeSessions.delete(sessionId);

    // Remove from user sessions
    session.participants.forEach(participantId => {
      const userSessions = this.userSessions.get(participantId) || [];
      const updatedSessions = userSessions.filter(id => id !== sessionId);
      this.userSessions.set(participantId, updatedSessions);
    });
  }

  private async getAppState(sessionId: string): Promise<Record<string, any>> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    return session.state;
  }

  private async calculate(expression: string): Promise<number> {
    return this.evaluateExpression(expression);
  }

  private evaluateExpression(expression: string): number {
    // Safe expression evaluation - only allow basic math operations
    const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, '');
    if (sanitized !== expression) {
      throw new Error('Invalid characters in expression');
    }
    
    try {
      return Function(`"use strict"; return (${sanitized})`)();
    } catch {
      throw new Error('Invalid mathematical expression');
    }
  }

  private async convertCurrency(amount: number, from: string, to: string): Promise<{ amount: number; rate: number }> {
    const rate = this.getMockConversionRate(from, to);
    return {
      amount: amount * rate,
      rate,
    };
  }

  private getMockConversionRate(from: string, to: string): number {
    // Mock conversion rates - in production would use real price APIs
    const rates: Record<string, Record<string, number>> = {
      'USD': { 'ETH': 0.0003, 'BTC': 0.000015, 'EUR': 0.85 },
      'ETH': { 'USD': 3500, 'BTC': 0.05, 'EUR': 2975 },
      'BTC': { 'USD': 67000, 'ETH': 20, 'EUR': 56950 },
      'EUR': { 'USD': 1.18, 'ETH': 0.00034, 'BTC': 0.000018 },
    };

    return rates[from.toUpperCase()]?.[to.toUpperCase()] || 1;
  }

  private async createPoll(question: string, options: string[], conversationId: string): Promise<{ id: string; question: string; options: string[] }> {
    const pollId = uuidv4();
    // In production, would store poll data persistently
    return {
      id: pollId,
      question,
      options,
    };
  }

  private isAppRequest(content: string): boolean {
    return ['app', 'launch', 'open', 'start app'].some(phrase => content.includes(phrase));
  }

  private isCalculationRequest(content: string): boolean {
    return ['calculate', 'calculator', 'math', 'compute'].some(word => content.includes(word));
  }

  private isConversionRequest(content: string): boolean {
    return ['convert', 'converter', 'exchange', 'rate'].some(word => content.includes(word));
  }

  private isPollRequest(content: string): boolean {
    return ['poll', 'vote', 'survey', 'voting'].some(word => content.includes(word));
  }

  private async handleAppRequest(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    const apps = await this.listApps();
    const appList = apps.map(app => `${app.icon} **${app.name}**: ${app.description}`).join('\n');
    
    return {
      message: `🚀 **Available Mini-Apps:**\n\n${appList}\n\nWhich app would you like to launch?`,
      metadata: { handledBy: 'miniapp-list' }
    };
  }

  private async handleCalculation(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    // Extract calculation from message
    const match = typeof message.content === 'string' ? message.content.match(/calculate\s+(.+)|(.+)\s*=\s*\?/i) : null;
    if (match) {
      const expression = match[1] || match[2];
      try {
        const result = await this.calculate(expression);
        return {
          message: `🧮 **Calculation Result:**\n\n${expression} = **${result}**`,
          metadata: { handledBy: 'miniapp-calculator' }
        };
      } catch (error) {
        return {
          message: `❌ Invalid expression: ${expression}`,
          metadata: { handledBy: 'miniapp-calculator-error' }
        };
      }
    }
    
    return {
      message: "🧮 I can help you with calculations! Try asking 'calculate 2 + 2' or '10 * 5 = ?'",
      metadata: { handledBy: 'miniapp-calculator-help' }
    };
  }

  private async handleConversion(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    return {
      message: "💱 I can convert between currencies and cryptocurrencies! Try 'convert 100 USD to ETH' or launch the Currency Converter app.",
      metadata: { handledBy: 'miniapp-converter' }
    };
  }

  private async handlePoll(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    return {
      message: "📊 I can create polls for group decisions! Try 'create poll: What should we do tonight?' or launch the Poll Creator app.",
      metadata: { handledBy: 'miniapp-poll' }
    };
  }

  protected getSystemPrompt(): string {
    return `You are a MiniApp Agent specialized in launching and managing mini-applications within conversations.

Your capabilities include:
- Managing a library of useful mini-applications
- Launching apps within conversations for multiple users
- Providing utility tools like calculators and converters
- Creating interactive polls and surveys
- Managing app sessions and user interactions

Available mini-apps:
- Calculator: Mathematical calculations
- Currency Converter: Fiat and crypto conversion
- Poll Creator: Group voting and surveys
- Expense Tracker: Shared expense management
- Token Scanner: Smart contract analysis
- NFT Viewer: NFT collection browsing

You help users:
1. Discover and launch relevant mini-apps
2. Perform quick calculations and conversions
3. Create interactive group tools
4. Manage ongoing app sessions
5. Provide seamless in-chat utility functions

Keep interactions simple and focused on utility. Launch apps when users need persistent functionality, or provide quick results for simple queries.

Current context: Managing mini-applications within XMTP conversations.`;
  }
}

export default MiniAppAgent; 
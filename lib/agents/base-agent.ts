import { DecodedMessage, Client as XMTPClient } from '@xmtp/browser-sdk';
import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { EventEmitter } from 'events';
import winston from 'winston';
import {
  BaseAgentConfig,
  AgentContext,
  AgentResponse,
  XMTPMessage,
  ConversationContext,
  AgentError,
  LogEntry
} from '../types';

/**
 * Base class for all agents in the BasedAgents system
 * Provides common functionality for XMTP messaging, blockchain integration, and AI processing
 */
export abstract class BaseAgent extends EventEmitter {
  protected config: BaseAgentConfig;
  protected llm: BaseLanguageModel;
  protected tools: DynamicStructuredTool[] = [];
  protected logger: winston.Logger;
  protected conversationContexts: Map<string, ConversationContext> = new Map();
  protected userMemory: Map<string, Record<string, any>> = new Map();

  constructor(config: BaseAgentConfig) {
    super();
    this.config = config;
    this.logger = this.createLogger();
    this.llm = this.createLLM();
    this.initializeTools();
  }

  /**
   * Initialize the agent with all necessary components
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info(`${this.config.name} agent initialized successfully`);
      this.emit('initialized', { agentName: this.config.name });
    } catch (error) {
      this.logger.error('Failed to initialize agent', { error, agentName: this.config.name });
      throw new AgentError(`Failed to initialize ${this.config.name}`, this.config.name, { error });
    }
  }

  /**
   * Process an incoming XMTP message and generate a response
   */
  async processMessage(
    message: DecodedMessage,
    context: AgentContext
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      // Update conversation context
      await this.updateConversationContext(message, context);
      
      // Check if this agent should handle the message
      if (!await this.shouldHandleMessage(message, context)) {
        return await this.createDelegationResponse(message, context);
      }

      // Process the message with the agent
      const response = await this.handleMessage(message, context);
      
      // Update agent memory
      await this.updateAgentMemory(context.userId, message, response);
      
      // Log performance metrics
      const processingTime = Date.now() - startTime;
      this.logger.info('Message processed successfully', {
        agentName: this.config.name,
        userId: context.userId,
        conversationId: context.conversationId,
        processingTime,
        messageLength: (message.content as string).length
      });

      this.emit('messageProcessed', {
        agentName: this.config.name,
        response,
        processingTime
      });

      return response;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Failed to process message', {
        error,
        agentName: this.config.name,
        userId: context.userId,
        processingTime
      });

      this.emit('messageError', {
        agentName: this.config.name,
        error,
        processingTime
      });

      return this.createErrorResponse(error as Error);
    }
  }

  /**
   * Abstract method for handling messages - to be implemented by specific agents
   */
  protected abstract handleMessage(
    message: DecodedMessage,
    context: AgentContext
  ): Promise<AgentResponse>;

  /**
   * Determine if this agent should handle the given message
   */
  protected abstract shouldHandleMessage(
    message: DecodedMessage,
    context: AgentContext
  ): Promise<boolean>;

  /**
   * Initialize agent-specific tools
   */
  protected abstract initializeTools(): void;

  /**
   * Create the OpenAI language model instance
   */
  private createLLM(): BaseLanguageModel {
    return new ChatOpenAI({
      modelName: 'gpt-4o',
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Process a message using the LLM with context
   */
  protected async processWithLLM(message: string, context: AgentContext): Promise<string> {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', this.getSystemPrompt()],
      ['human', message],
    ]);

    const formattedPrompt = await prompt.format({
      input: message,
      chat_history: this.formatChatHistory(context.messageHistory),
    });

    const response = await this.llm.invoke(formattedPrompt);
    return response.content as string;
  }

  /**
   * Format chat history for context
   */
  private formatChatHistory(history: DecodedMessage[]): string {
    return history.slice(-5).map(msg => 
      `${msg.senderInboxId}: ${msg.content}`
    ).join('\n');
  }

  /**
   * Get the system prompt for this agent
   */
  protected getSystemPrompt(): string {
    return `You are ${this.config.name}, ${this.config.description}.

Your capabilities include: ${this.config.capabilities.join(', ')}.

You are part of the BasedAgents multi-agent system built for secure messaging on XMTP and onchain operations on Base.

Key guidelines:
1. Always be helpful and provide accurate information
2. Use blockchain tools only when explicitly requested or necessary
3. Maintain user privacy and security at all times
4. If you cannot handle a request, suggest the appropriate agent
5. Be concise but informative in your responses
6. Always confirm before executing any transactions

Current context: You are responding to a message in a conversation. Consider the conversation history and user preferences when responding.`;
  }

  /**
   * Update conversation context with new message
   */
  private async updateConversationContext(
    message: DecodedMessage,
    context: AgentContext
  ): Promise<void> {
    const conversationId = context.conversationId;
    const existingContext = this.conversationContexts.get(conversationId);

    const updatedContext: ConversationContext = {
      id: conversationId,
      participants: existingContext?.participants || [message.senderInboxId],
      isGroup: existingContext?.isGroup || false,
      topic: existingContext?.topic,
      metadata: existingContext?.metadata || {},
      lastActivity: new Date(),
      messageCount: (existingContext?.messageCount || 0) + 1,
    };

    // Add sender if not already in participants
    if (!updatedContext.participants.includes(message.senderInboxId)) {
      updatedContext.participants.push(message.senderInboxId);
    }

    this.conversationContexts.set(conversationId, updatedContext);
  }

  /**
   * Update agent memory for a user
   */
  private async updateAgentMemory(
    userId: string,
    message: DecodedMessage,
    response: AgentResponse
  ): Promise<void> {
    const currentMemory = this.userMemory.get(userId) || {};
    
    const updatedMemory = {
      ...currentMemory,
      lastInteraction: new Date().toISOString(),
      messageCount: (currentMemory.messageCount || 0) + 1,
      lastMessage: message.content,
      lastResponse: response.message,
      agentName: this.config.name,
    };

    this.userMemory.set(userId, updatedMemory);
  }

  /**
   * Create a response for delegation to another agent
   */
  protected async createDelegationResponse(
    message: DecodedMessage,
    context: AgentContext
  ): Promise<AgentResponse> {
    return {
      message: `I'm not the best agent to handle this request. Let me connect you with the right specialist.`,
      metadata: {
        delegated: true,
        originalAgent: this.config.name,
      },
      nextAgent: await this.suggestNextAgent(message, context),
    };
  }

  /**
   * Suggest the next agent based on message content
   */
  protected abstract suggestNextAgent(
    message: DecodedMessage,
    context: AgentContext
  ): Promise<string>;

  /**
   * Create an error response
   */
  protected createErrorResponse(error: Error): AgentResponse {
    this.logger.error('Agent error', { error, agentName: this.config.name });
    
    return {
      message: `I encountered an error while processing your request. Please try again or contact support if the issue persists.`,
      metadata: {
        error: true,
        errorType: error.constructor.name,
        agentName: this.config.name,
      },
    };
  }

  /**
   * Create logger instance for this agent
   */
  private createLogger(): winston.Logger {
    return winston.createLogger({
      level: process.env.AGENT_LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { agent: this.config.name, version: this.config.version },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        new winston.transports.File({
          filename: `logs/${this.config.name}-error.log`,
          level: 'error',
        }),
        new winston.transports.File({
          filename: `logs/${this.config.name}.log`,
        }),
      ],
    });
  }

  /**
   * Get agent configuration
   */
  public getConfig(): BaseAgentConfig {
    return { ...this.config };
  }

  /**
   * Get agent health status
   */
  public getHealth(): {
    isActive: boolean;
    conversationCount: number;
    memoryUsage: number;
    lastActivity: Date | null;
  } {
    return {
      isActive: this.config.isActive,
      conversationCount: this.conversationContexts.size,
      memoryUsage: this.userMemory.size,
      lastActivity: this.getLastActivity(),
    };
  }

  /**
   * Get the last activity timestamp
   */
  private getLastActivity(): Date | null {
    let lastActivity: Date | null = null;
    
    for (const context of this.conversationContexts.values()) {
      if (!lastActivity || context.lastActivity > lastActivity) {
        lastActivity = context.lastActivity;
      }
    }
    
    return lastActivity;
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.conversationContexts.clear();
    this.userMemory.clear();
    this.removeAllListeners();
    this.logger.info(`${this.config.name} agent cleaned up`);
  }
}

export default BaseAgent; 
import { Client, DecodedMessage, Conversation, Signer as XmtpSigner } from '@xmtp/browser-sdk';
import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import winston from 'winston';
import { XMTPError } from '../types';
import { createSigner, getEncryptionKeyFromHex } from "../../helpers/client";

/**
 * XMTP Client wrapper for managing secure messaging connections
 */
export class XMTPClientManager extends EventEmitter {
  private client?: Client;
  private logger: winston.Logger;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds
  private messageStreams: Map<string, AsyncIterable<DecodedMessage>> = new Map();

  constructor() {
    super();
    this.logger = this.createLogger();
  }

  /**
   * Initialize XMTP client with wallet and configuration
   */
  async initialize(): Promise<void> {
    try {
      const signer = createSigner(process.env.WALLET_PRIVATE_KEY!);
      const dbEncryptionKey = getEncryptionKeyFromHex(process.env.ENCRYPTION_KEY!);
      const env = (process.env.XMTP_ENV as 'dev' | 'production' | 'local') || 'production';
      
      this.logger.info('Initializing XMTP client', { env, address: signer.getIdentifier().identifier });

      this.client = await Client.create(signer, {
        dbEncryptionKey,
        env,
      });

      await this.client.conversations.sync();
      this.isConnected = true;
      this.reconnectAttempts = 0;

      this.logger.info('XMTP client initialized successfully', {
        address: this.client.inboxId,
        env,
      });

      this.emit('connected', { inboxId: this.client.inboxId });
    } catch (error) {
      this.logger.error('Failed to initialize XMTP client', { error });
      throw new XMTPError('Failed to initialize XMTP client', { error });
    }
  }

  /**
   * Start listening for all messages across conversations
   */
  async startMessageStream(): Promise<void> {
    if (!this.client) {
      throw new XMTPError('Client not initialized');
    }

    try {
      this.logger.info('Starting message stream');
      
      const stream = await this.client.conversations.streamAllMessages();
      
      for await (const message of stream) {
        await this.handleIncomingMessage(message);
      }
    } catch (error) {
      this.logger.error('Error in message stream', { error });
      this.isConnected = false;
      this.emit('disconnected', { error });
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        await this.reconnect();
      } else {
        this.emit('error', new XMTPError('Max reconnection attempts exceeded', { error }));
      }
    }
  }

  /**
   * Start listening for messages in a specific conversation
   */
  async streamConversationMessages(conversationId: string): Promise<void> {
    if (!this.client) {
      throw new XMTPError('Client not initialized');
    }

    try {
      const conversation = await this.client.conversations.getConversationById(conversationId);
      if (!conversation) {
        throw new XMTPError(`Conversation ${conversationId} not found`);
      }

      const stream = await conversation.streamMessages();
      this.messageStreams.set(conversationId, stream);

      for await (const message of stream) {
        await this.handleIncomingMessage(message);
      }
    } catch (error) {
      this.logger.error('Error streaming conversation messages', { error, conversationId });
      this.messageStreams.delete(conversationId);
      throw new XMTPError('Failed to stream conversation messages', { error, conversationId });
    }
  }

  /**
   * Send a message to a conversation
   */
  async sendMessage(conversationId: string, content: string): Promise<void> {
    if (!this.client) {
      throw new XMTPError('Client not initialized');
    }

    try {
      const conversation = await this.client.conversations.getConversationById(conversationId);
      if (!conversation) {
        throw new XMTPError(`Conversation ${conversationId} not found`);
      }

      await conversation.send(content);
      
      this.logger.info('Message sent successfully', {
        conversationId,
        messageLength: content.length,
      });

      this.emit('messageSent', {
        conversationId,
        content,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to send message', { error, conversationId });
      throw new XMTPError('Failed to send message', { error, conversationId });
    }
  }

  /**
   * Create a new conversation with participants
   */
  async createConversation(participants: string[]): Promise<string> {
    if (!this.client) {
      throw new XMTPError('Client not initialized');
    }

    try {
      let conversation: Conversation;

      if (participants.length === 1) {
        // Create 1:1 conversation
        conversation = await this.client.conversations.newConversation(participants[0]);
      } else {
        // Create group conversation
        conversation = await this.client.conversations.newGroup(participants);
      }

      this.logger.info('Conversation created', {
        conversationId: conversation.id,
        participants,
        isGroup: participants.length > 1,
      });

      this.emit('conversationCreated', {
        conversationId: conversation.id,
        participants,
        isGroup: participants.length > 1,
      });

      return conversation.id;
    } catch (error) {
      this.logger.error('Failed to create conversation', { error, participants });
      throw new XMTPError('Failed to create conversation', { error, participants });
    }
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    if (!this.client) {
      throw new XMTPError('Client not initialized');
    }

    try {
      return await this.client.conversations.getConversationById(conversationId);
    } catch (error) {
      this.logger.error('Failed to get conversation', { error, conversationId });
      return null;
    }
  }

  /**
   * List all conversations
   */
  async listConversations(): Promise<Conversation[]> {
    if (!this.client) {
      throw new XMTPError('Client not initialized');
    }

    try {
      return await this.client.conversations.list();
    } catch (error) {
      this.logger.error('Failed to list conversations', { error });
      throw new XMTPError('Failed to list conversations', { error });
    }
  }

  /**
   * Sync conversations from the network
   */
  async syncConversations(): Promise<void> {
    if (!this.client) {
      throw new XMTPError('Client not initialized');
    }

    try {
      await this.client.conversations.sync();
      this.logger.info('Conversations synced successfully');
    } catch (error) {
      this.logger.error('Failed to sync conversations', { error });
      throw new XMTPError('Failed to sync conversations', { error });
    }
  }

  /**
   * Handle incoming message
   */
  private async handleIncomingMessage(message: DecodedMessage): Promise<void> {
    try {
      // Skip messages from self
      if (message.senderInboxId === this.client?.inboxId) {
        return;
      }

      this.logger.info('Received message', {
        conversationId: message.conversationId,
        senderInboxId: message.senderInboxId,
        messageLength: message.content.length,
        timestamp: new Date(),
      });

      this.emit('messageReceived', message);
    } catch (error) {
      this.logger.error('Error handling incoming message', { error, messageId: message.id });
    }
  }

  /**
   * Reconnect to XMTP network
   */
  private async reconnect(): Promise<void> {
    this.reconnectAttempts++;
    this.logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));

    try {
      await this.initialize();
      this.emit('reconnected', { attempts: this.reconnectAttempts });
    } catch (error) {
      this.logger.error('Reconnection failed', { error, attempt: this.reconnectAttempts });
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        await this.reconnect();
      }
    }
  }

  /**
   * Create logger instance
   */
  private createLogger(): winston.Logger {
    return winston.createLogger({
      level: process.env.AGENT_LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'xmtp-client' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        new winston.transports.File({
          filename: 'logs/xmtp-error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/xmtp.log',
        }),
      ],
    });
  }

  /**
   * Get client status
   */
  public getStatus(): {
    isConnected: boolean;
    inboxId?: string;
    reconnectAttempts: number;
    activeStreams: number;
  } {
    return {
      isConnected: this.isConnected,
      inboxId: this.client?.inboxId,
      reconnectAttempts: this.reconnectAttempts,
      activeStreams: this.messageStreams.size,
    };
  }

  /**
   * Get inbox ID
   */
  public getInboxId(): string | undefined {
    return this.client?.inboxId;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.isConnected = false;
    this.messageStreams.clear();
    this.removeAllListeners();
    this.logger.info('XMTP client cleaned up');
  }
}

export default XMTPClientManager; 
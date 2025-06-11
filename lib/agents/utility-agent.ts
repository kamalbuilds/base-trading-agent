import { DecodedMessage } from '@xmtp/node-sdk';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseAgent } from './base-agent';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import {
  UtilityAgentConfig,
  AgentContext,
  AgentResponse,
  EventPlan,
  Expense,
  PaymentSplit,
  PaymentParticipant,
} from '../types';

/**
 * UtilityAgent handles practical group coordination tasks
 */
export class UtilityAgent extends BaseAgent {
  private events: Map<string, EventPlan> = new Map();
  private paymentSplits: Map<string, PaymentSplit> = new Map();
  private expenses: Map<string, Expense[]> = new Map();

  constructor(config: UtilityAgentConfig) {
    super(config);
  }

  protected initializeTools(): void {
    this.tools.push(
      new DynamicStructuredTool({
        name: 'create_event',
        description: 'Create a new event with participants and details',
        schema: z.object({
          title: z.string(),
          description: z.string(),
          dateTime: z.string(),
          location: z.string().optional(),
          participants: z.array(z.string()),
          budget: z.number().optional(),
        }),
        func: async ({ title, description, dateTime, location, participants, budget }) => {
          const event = await this.createEvent(title, description, new Date(dateTime), location, participants, budget);
          return `Event "${title}" created with ID: ${event.id}`;
        },
      }),
      
      new DynamicStructuredTool({
        name: 'create_payment_split',
        description: 'Create a payment split among participants',
        schema: z.object({
          totalAmount: z.number(),
          currency: z.string(),
          participants: z.array(z.string()),
          method: z.enum(['equal', 'custom', 'percentage']),
        }),
        func: async ({ totalAmount, currency, participants, method }) => {
          const split = await this.createPaymentSplit(totalAmount, currency, participants, method);
          return `Payment split created: ${totalAmount} ${currency}`;
        },
      })
    );
  }

  protected async handleMessage(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    const content = message.content.toLowerCase();
    
    if (this.isEventPlanningQuery(content)) {
      return await this.handleEventPlanning(message, context);
    } else if (this.isPaymentQuery(content)) {
      return await this.handlePaymentSplitting(message, context);
    }
    
    // Process with LLM for complex queries
    const response = await this.processWithLLM(message.content, context);

    return {
      message: response,
      metadata: { handledBy: 'utility-agent' }
    };
  }

  protected async shouldHandleMessage(message: DecodedMessage, context: AgentContext): Promise<boolean> {
    const content = message.content.toLowerCase();
    const utilityKeywords = ['event', 'plan', 'payment', 'split', 'expense', 'cost', 'wallet', 'shared'];
    return utilityKeywords.some(keyword => content.includes(keyword));
  }

  protected async suggestNextAgent(message: DecodedMessage, context: AgentContext): Promise<string> {
    const content = message.content.toLowerCase();
    
    if (content.includes('trade') || content.includes('defi')) return 'trading';
    if (content.includes('game') || content.includes('play')) return 'gaming';
    if (content.includes('social') || content.includes('content')) return 'social';
    
    return 'master';
  }

  private async createEvent(title: string, description: string, dateTime: Date, location?: string, participants?: string[], budget?: number): Promise<EventPlan> {
    const event: EventPlan = {
      id: uuidv4(),
      title,
      description,
      dateTime,
      location,
      participants: participants || [],
      budget,
      expenses: [],
      status: 'planning'
    };

    this.events.set(event.id, event);
    return event;
  }

  private async createPaymentSplit(totalAmount: number, currency: string, participants: string[], method: 'equal' | 'custom' | 'percentage'): Promise<PaymentSplit> {
    const splitId = uuidv4();
    const amountPerPerson = method === 'equal' ? totalAmount / participants.length : 0;
    
    const splitParticipants: PaymentParticipant[] = participants.map(address => ({
      address,
      amount: amountPerPerson,
      paid: false
    }));

    const split: PaymentSplit = {
      id: splitId,
      totalAmount,
      currency,
      participants: splitParticipants,
      method,
      status: 'pending'
    };

    this.paymentSplits.set(splitId, split);
    return split;
  }

  private isEventPlanningQuery(content: string): boolean {
    return ['event', 'plan', 'organize', 'schedule'].some(keyword => content.includes(keyword));
  }

  private isPaymentQuery(content: string): boolean {
    return ['payment', 'split', 'pay', 'money', 'cost'].some(keyword => content.includes(keyword));
  }

  private async handleEventPlanning(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    return {
      message: "I'd be happy to help you plan your event! Please provide details like the event title, date, location, and participants.",
      metadata: { handledBy: 'utility-event-planning' }
    };
  }

  private async handlePaymentSplitting(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    return {
      message: "I can help you split payments! Let me know the total amount, currency, and participants.",
      metadata: { handledBy: 'utility-payment-splitting' }
    };
  }

  protected getSystemPrompt(): string {
    return `You are a Utility Agent specialized in group coordination and practical tasks.

Your capabilities include:
- Event planning and organization
- Payment splitting and expense tracking  
- Shared wallet management
- Scheduling and reminders

Always be helpful, organized, and detail-oriented. When handling financial transactions, ensure all participants understand the costs and payment methods.`;
  }
} 
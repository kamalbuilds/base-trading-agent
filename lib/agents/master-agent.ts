import { DecodedMessage } from '@xmtp/node-sdk';
import { Tool } from '@langchain/core/tools';
import { BaseAgent } from './base-agent';
import {
  MasterAgentConfig,
  AgentContext,
  AgentResponse,
  RoutingRule,
  BaseAgentConfig,
  AgentError,
} from '../types';

/**
 * MasterAgent orchestrates all other agents in the system
 * Handles routing, delegation, and system-wide coordination
 */
export class MasterAgent extends BaseAgent {
  private routingRules: RoutingRule[];
  private registeredAgents: Map<string, BaseAgent> = new Map();
  private agentConfigs: Map<string, BaseAgentConfig> = new Map();

  constructor(config: MasterAgentConfig) {
    super(config);
    this.routingRules = config.routingRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Register an agent with the master agent
   */
  async registerAgent(agent: BaseAgent): Promise<void> {
    const agentConfig = agent.getConfig();
    
    if (!agentConfig.isActive) {
      this.logger.warn(`Skipping registration of inactive agent: ${agentConfig.name}`);
      return;
    }

    this.registeredAgents.set(agentConfig.name, agent);
    this.agentConfigs.set(agentConfig.name, agentConfig);
    
    this.logger.info(`Registered agent: ${agentConfig.name}`, {
      capabilities: agentConfig.capabilities,
      version: agentConfig.version,
    });

    // Listen to agent events
    agent.on('messageProcessed', (data) => {
      this.emit('agentActivity', { ...data, timestamp: new Date() });
    });

    agent.on('messageError', (data) => {
      this.emit('agentError', { ...data, timestamp: new Date() });
    });
  }

  /**
   * Unregister an agent
   */
  async unregisterAgent(agentName: string): Promise<void> {
    const agent = this.registeredAgents.get(agentName);
    if (agent) {
      await agent.cleanup();
      this.registeredAgents.delete(agentName);
      this.agentConfigs.delete(agentName);
      this.logger.info(`Unregistered agent: ${agentName}`);
    }
  }

  /**
   * Initialize agent-specific tools for the master agent
   */
  protected initializeTools(): void {
    // Master agent tools for system management
    this.tools.push(
      new Tool({
        name: 'list_agents',
        description: 'List all registered agents and their capabilities',
        func: async () => {
          const agents = Array.from(this.agentConfigs.values()).map(config => ({
            name: config.name,
            description: config.description,
            capabilities: config.capabilities,
            isActive: config.isActive,
          }));
          return JSON.stringify(agents, null, 2);
        },
      }),
      
      new Tool({
        name: 'get_agent_health',
        description: 'Get health status of all agents',
        func: async () => {
          const healthData: Record<string, any> = {};
          
          for (const [name, agent] of this.registeredAgents) {
            healthData[name] = agent.getHealth();
          }
          
          return JSON.stringify(healthData, null, 2);
        },
      }),

      new Tool({
        name: 'route_to_agent',
        description: 'Route a request to a specific agent by name',
        func: async (input: string) => {
          const { agentName, message } = JSON.parse(input);
          const agent = this.registeredAgents.get(agentName);
          
          if (!agent) {
            return `Agent "${agentName}" not found. Available agents: ${Array.from(this.registeredAgents.keys()).join(', ')}`;
          }
          
          return `Routing request to ${agentName}: ${message}`;
        },
      })
    );
  }

  /**
   * Handle incoming messages by routing to appropriate agents
   */
  protected async handleMessage(
    message: DecodedMessage,
    context: AgentContext
  ): Promise<AgentResponse> {
    try {
      // Find the best agent to handle this message
      const targetAgent = await this.findBestAgent(message, context);
      
      if (!targetAgent) {
        return this.createFallbackResponse(message, context);
      }

      // If routing to another agent, delegate the message
      if (targetAgent !== this.config.name) {
        return await this.delegateToAgent(targetAgent, message, context);
      }

      // Handle system-level queries that the master agent should handle directly
      if (await this.isSystemQuery(message)) {
        return await this.handleSystemQuery(message, context);
      }

      // Default response for master agent
      return {
        message: this.generateMasterResponse(message, context),
        metadata: {
          handledBy: 'master',
          availableAgents: Array.from(this.registeredAgents.keys()),
        },
      };
    } catch (error) {
      this.logger.error('Error in master agent message handling', { error });
      return this.createErrorResponse(error as Error);
    }
  }

  /**
   * Find the best agent to handle a message based on routing rules
   */
  private async findBestAgent(
    message: DecodedMessage,
    context: AgentContext
  ): Promise<string | null> {
    const messageContent = message.content.toLowerCase();
    
    // Check routing rules in priority order
    for (const rule of this.routingRules) {
      let matches = false;
      
      if (typeof rule.pattern === 'string') {
        matches = messageContent.includes(rule.pattern.toLowerCase());
      } else {
        matches = rule.pattern.test(messageContent);
      }
      
      if (matches && this.evaluateConditions(rule.conditions, message, context)) {
        // Verify the agent is registered and active
        const agent = this.registeredAgents.get(rule.agent);
        if (agent && agent.getConfig().isActive) {
          return rule.agent;
        }
      }
    }

    // Fallback to intelligent routing based on content analysis
    return await this.intelligentRouting(message, context);
  }

  /**
   * Intelligent routing based on message content analysis
   */
  private async intelligentRouting(
    message: DecodedMessage,
    context: AgentContext
  ): Promise<string | null> {
    const content = message.content.toLowerCase();
    
    // Trading/DeFi keywords
    if (this.containsKeywords(content, ['trade', 'swap', 'buy', 'sell', 'price', 'token', 'defi', 'portfolio', 'balance'])) {
      return this.getActiveAgent('TradingAgent');
    }
    
    // Gaming keywords
    if (this.containsKeywords(content, ['game', 'play', 'bet', 'trivia', 'quiz', 'challenge', 'compete'])) {
      return this.getActiveAgent('GamingAgent');
    }
    
    // Utility keywords
    if (this.containsKeywords(content, ['event', 'plan', 'split', 'expense', 'share', 'organize', 'schedule'])) {
      return this.getActiveAgent('UtilityAgent');
    }
    
    // Social keywords
    if (this.containsKeywords(content, ['news', 'update', 'content', 'recommend', 'social', 'feed'])) {
      return this.getActiveAgent('SocialAgent');
    }
    
    // MiniApp keywords
    if (this.containsKeywords(content, ['app', 'launch', 'open', 'tool', 'calculator', 'converter'])) {
      return this.getActiveAgent('MiniAppAgent');
    }
    
    return null; // Let master agent handle
  }

  /**
   * Check if content contains any of the specified keywords
   */
  private containsKeywords(content: string, keywords: string[]): boolean {
    return keywords.some(keyword => content.includes(keyword));
  }

  /**
   * Get an active agent by name
   */
  private getActiveAgent(agentName: string): string | null {
    const agent = this.registeredAgents.get(agentName);
    return agent && agent.getConfig().isActive ? agentName : null;
  }

  /**
   * Evaluate routing rule conditions
   */
  private evaluateConditions(
    conditions: Record<string, any> | undefined,
    message: DecodedMessage,
    context: AgentContext
  ): boolean {
    if (!conditions) return true;
    
    // Implement condition evaluation logic
    // For now, return true - can be extended with complex conditions
    return true;
  }

  /**
   * Delegate message to a specific agent
   */
  private async delegateToAgent(
    agentName: string,
    message: DecodedMessage,
    context: AgentContext
  ): Promise<AgentResponse> {
    const agent = this.registeredAgents.get(agentName);
    
    if (!agent) {
      throw new AgentError(`Agent ${agentName} not found`, 'MasterAgent');
    }

    this.logger.info(`Delegating message to ${agentName}`, {
      messageLength: message.content.length,
      userId: context.userId,
    });

    const response = await agent.processMessage(message, context);
    
    // Add delegation metadata
    response.metadata = {
      ...response.metadata,
      delegatedBy: 'MasterAgent',
      delegatedTo: agentName,
    };

    return response;
  }

  /**
   * Check if the message is a system-level query
   */
  private async isSystemQuery(message: DecodedMessage): boolean {
    const content = message.content.toLowerCase();
    const systemKeywords = [
      'help', 'agents', 'capabilities', 'health', 'status', 'system',
      'what can you do', 'who are you', 'available agents'
    ];
    
    return systemKeywords.some(keyword => content.includes(keyword));
  }

  /**
   * Handle system-level queries
   */
  private async handleSystemQuery(
    message: DecodedMessage,
    context: AgentContext
  ): Promise<AgentResponse> {
    const content = message.content.toLowerCase();
    
    if (content.includes('agents') || content.includes('capabilities')) {
      return this.listAgentsResponse();
    }
    
    if (content.includes('health') || content.includes('status')) {
      return this.getSystemHealthResponse();
    }
    
    if (content.includes('help') || content.includes('what can you do')) {
      return this.getHelpResponse();
    }
    
    return this.getGeneralSystemResponse();
  }

  /**
   * Generate list of available agents
   */
  private listAgentsResponse(): AgentResponse {
    const agents = Array.from(this.agentConfigs.values()).map(config => 
      `• **${config.name}**: ${config.description} (${config.capabilities.join(', ')})`
    ).join('\n');

    return {
      message: `🤖 **Available Agents:**\n\n${agents}\n\nJust ask me anything and I'll route you to the right specialist!`,
      metadata: { type: 'agent_list', agentCount: this.registeredAgents.size },
    };
  }

  /**
   * Generate system health response
   */
  private getSystemHealthResponse(): AgentResponse {
    const totalAgents = this.registeredAgents.size;
    const activeAgents = Array.from(this.registeredAgents.values())
      .filter(agent => agent.getConfig().isActive).length;

    return {
      message: `🟢 **System Status:**\n\n• Total Agents: ${totalAgents}\n• Active Agents: ${activeAgents}\n• XMTP Connected: ✅\n• Base Network: ✅\n\nAll systems operational!`,
      metadata: { type: 'system_health', totalAgents, activeAgents },
    };
  }

  /**
   * Generate help response
   */
  private getHelpResponse(): AgentResponse {
    return {
      message: `🚀 **Welcome to BaseAgents!**\n\nI'm your MasterAgent, orchestrating a team of specialized AI agents for onchain messaging and operations.\n\n**What I can help with:**\n• Route you to the right specialist agent\n• Provide system information\n• Coordinate multi-agent workflows\n\n**Try asking:**\n• "What's my portfolio worth?" (Trading)\n• "Let's play a game!" (Gaming)\n• "Plan an event for Friday" (Utility)\n• "Show me latest crypto news" (Social)\n• "Open a calculator" (MiniApp)\n\nJust tell me what you need!`,
      metadata: { type: 'help' },
    };
  }

  /**
   * Generate general system response
   */
  private getGeneralSystemResponse(): AgentResponse {
    return {
      message: `I'm the MasterAgent coordinating the BaseAgents system. How can I help you today?`,
      metadata: { type: 'general' },
    };
  }

  /**
   * Generate master agent response for unrouted messages
   */
  private generateMasterResponse(message: DecodedMessage, context: AgentContext): string {
    return `I'm here to help coordinate your requests across our agent team. Could you be more specific about what you'd like to do? You can ask about trading, games, events, social content, or mini-apps.`;
  }

  /**
   * Create fallback response when no suitable agent is found
   */
  private createFallbackResponse(message: DecodedMessage, context: AgentContext): AgentResponse {
    const config = this.config as MasterAgentConfig;
    const fallbackAgent = this.registeredAgents.get(config.fallbackAgent);
    
    if (fallbackAgent) {
      return {
        message: `I'm not sure which agent is best for this request. Let me connect you with our general assistant.`,
        nextAgent: config.fallbackAgent,
        metadata: { fallback: true },
      };
    }
    
    return {
      message: `I'm not sure how to handle that request right now. Could you try rephrasing or asking about something specific like trading, games, events, or social content?`,
      metadata: { fallback: true, noFallbackAgent: true },
    };
  }

  /**
   * Determine if this agent should handle the message
   */
  protected async shouldHandleMessage(
    message: DecodedMessage,
    context: AgentContext
  ): Promise<boolean> {
    // Master agent always evaluates messages first
    return true;
  }

  /**
   * Suggest next agent for delegation
   */
  protected async suggestNextAgent(
    message: DecodedMessage,
    context: AgentContext
  ): Promise<string> {
    // Use intelligent routing to suggest next agent
    const suggestion = await this.intelligentRouting(message, context);
    return suggestion || 'UtilityAgent'; // Default fallback
  }

  /**
   * Get system-wide statistics
   */
  public getSystemStats(): {
    totalAgents: number;
    activeAgents: number;
    totalConversations: number;
    totalMessages: number;
  } {
    const totalAgents = this.registeredAgents.size;
    const activeAgents = Array.from(this.registeredAgents.values())
      .filter(agent => agent.getConfig().isActive).length;
    
    let totalConversations = 0;
    let totalMessages = 0;
    
    for (const agent of this.registeredAgents.values()) {
      const health = agent.getHealth();
      totalConversations += health.conversationCount;
      totalMessages += health.memoryUsage;
    }
    
    return {
      totalAgents,
      activeAgents,
      totalConversations,
      totalMessages,
    };
  }

  /**
   * Enhanced system prompt for master agent
   */
  protected getSystemPrompt(): string {
    const basePrompt = super.getSystemPrompt();
    
    return `${basePrompt}

As the MasterAgent, you have special responsibilities:
1. Analyze incoming messages to route to the best specialist agent
2. Provide system information and agent coordination
3. Handle multi-agent workflows and complex requests
4. Maintain system health and monitor agent performance
5. Serve as the primary interface for users

Available specialist agents:
${Array.from(this.agentConfigs.values()).map(config => 
  `- ${config.name}: ${config.capabilities.join(', ')}`
).join('\n')}

When routing messages, consider:
- User intent and context
- Agent capabilities and availability
- Message complexity and requirements
- User preferences and history`;
  }
}

export default MasterAgent; 
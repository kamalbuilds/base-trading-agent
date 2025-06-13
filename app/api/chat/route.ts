import { NextRequest, NextResponse } from 'next/server';
import { BaseAgentsServer } from '../../../lib/agents/server';

// Global server instance (shared with agents route)
declare global {
  var agentServer: BaseAgentsServer | undefined;
}

/**
 * POST /api/chat - Send message to agents
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, agentType, conversationId, walletAddress } = body;

    // Validate required fields
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ 
        error: 'Message is required and must be a string'
      }, { status: 400 });
    }

    // Check if agent server is running
    if (!global.agentServer) {
      return NextResponse.json({ 
        error: 'Agent server is not running. Please start the agent server first.',
        suggestion: 'Use the system status to start agents'
      }, { status: 503 });
    }

    // Create agent context
    const context = {
      userId: walletAddress || 'anonymous',
      conversationId: conversationId || `conv_${Date.now()}`,
      timestamp: new Date(),
      metadata: {
        source: 'web_interface',
        agentType: agentType || 'master',
        walletAddress,
      }
    };

    // Simulate message processing (in real implementation, this would integrate with XMTP)
    const response = await processMessage(message, agentType, context);

    return NextResponse.json({
      success: true,
      response,
      context: {
        conversationId: context.conversationId,
        timestamp: context.timestamp,
        agentType: agentType || 'master'
      }
    });

  } catch (error) {
    console.error('Error processing chat message:', error);
    return NextResponse.json({ 
      error: 'Failed to process message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Process message through appropriate agent
 */
async function processMessage(message: string, agentType: string, context: any) {
  // Map UI agentType to agent class name
  const agentTypeMap: Record<string, string> = {
    master: 'MasterAgent',
    utility: 'UtilityAgent',
    trading: 'TradingAgent',
    game: 'GameAgent',
    social: 'SocialAgent',
    miniapp: 'MiniAppAgent',
  };
  const agentClassName = agentTypeMap[agentType?.toLowerCase()] || 'MasterAgent';

  // Get the agent instance from the global agent server
  const agent = global.agentServer?.getAgent?.(agentClassName);
  if (!agent) {
    throw new Error(`Agent ${agentClassName} not found or not initialized`);
  }

  // Call the agent's real message handler (which should use LLM + tools)
  // Construct a DecodedMessage-like object for processMessage
  const messageObj = {
    content: message,
    conversationId: context?.conversationId || 'web',
    id: `web-${Date.now()}`,
    senderInboxId: context?.walletAddress || 'web-user',
    sentAt: new Date(),
  };
  const agentResponse = await agent.processMessage?.(messageObj, context);

  // Return the real response (text, actions, etc.)
  return {
    text: agentResponse?.message || '',
    agent: agentType,
    actions: agentResponse?.actions || [],
    timestamp: new Date().toISOString()
  };
} 
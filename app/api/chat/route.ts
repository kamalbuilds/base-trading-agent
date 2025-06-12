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
  const agentResponses = {
    master: `🎯 **MasterAgent**: I've analyzed your message "${message}". I can help route you to the right specialist or handle general queries. What would you like to do?`,
    
    utility: `🔧 **UtilityAgent**: I can help with event planning, payment splitting, and group coordination. For "${message}", I suggest creating a group event or setting up shared payments.`,
    
    trading: `📈 **TradingAgent**: I can assist with DeFi operations and portfolio management. Regarding "${message}", would you like me to check current market prices or help with token swaps?`,
    
    game: `🎮 **GameAgent**: Ready to play! For "${message}", I can start a trivia game, word game, or create an interactive betting scenario with the group.`,
    
    social: `📱 **SocialAgent**: I can help curate content and manage social interactions. Based on "${message}", I can share trending topics or relevant news for your group.`,
    
    miniapp: `🛠️ **MiniAppAgent**: I can launch mini-applications within the chat. For "${message}", I could start a calculator, converter, or other utility tools.`
  };

  const selectedAgent = agentType?.toLowerCase() || 'master';
  const response = agentResponses[selectedAgent as keyof typeof agentResponses] || agentResponses.master;

  // Simulate some processing time
  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    text: response,
    agent: selectedAgent,
    actions: generateSampleActions(selectedAgent, message),
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate sample actions based on agent type and message
 */
function generateSampleActions(agentType: string, message: string) {
  const actionSets = {
    utility: [
      { type: 'create_event', label: 'Create Event', description: 'Plan a new group event' },
      { type: 'split_payment', label: 'Split Payment', description: 'Split a bill among participants' }
    ],
    trading: [
      { type: 'check_prices', label: 'Check Prices', description: 'View current token prices' },
      { type: 'portfolio_view', label: 'View Portfolio', description: 'See your holdings' }
    ],
    game: [
      { type: 'start_trivia', label: 'Start Trivia', description: 'Begin a trivia game' },
      { type: 'word_game', label: 'Word Game', description: 'Play a word-based game' }
    ],
    social: [
      { type: 'trending_news', label: 'Trending News', description: 'Show trending topics' },
      { type: 'group_insights', label: 'Group Insights', description: 'Analyze group activity' }
    ],
    miniapp: [
      { type: 'calculator', label: 'Calculator', description: 'Open calculator app' },
      { type: 'converter', label: 'Unit Converter', description: 'Convert between units' }
    ]
  };

  return actionSets[agentType as keyof typeof actionSets] || [
    { type: 'help', label: 'Get Help', description: 'Show available commands' }
  ];
} 
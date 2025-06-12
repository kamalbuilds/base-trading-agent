import { NextRequest, NextResponse } from 'next/server';
import { BaseAgentsServer } from '../../../lib/agents/server';

// Global server instance using globalThis for Next.js
declare global {
  var agentServer: BaseAgentsServer | undefined;
}

/**
 * GET /api/agents - Get agent status and health
 */
export async function GET(request: NextRequest) {
  try {
    if (!global.agentServer) {
      return NextResponse.json({ 
        error: 'Agent server not initialized',
        agents: [],
        health: { status: 'offline', uptime: 0, agents: {}, xmtpConnected: false, lastHealthCheck: '' }
      }, { status: 503 });
    }

    const health = global.agentServer.getSystemHealth();
    
    return NextResponse.json({
      success: true,
      health,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting agent status:', error);
    return NextResponse.json({ 
      error: 'Failed to get agent status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/agents - Start/manage agent server
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'start':
        if (global.agentServer && global.agentServer.getSystemHealth().status === 'healthy') {
          return NextResponse.json({ 
            message: 'Agent server already running',
            health: global.agentServer.getSystemHealth()
          });
        }

        global.agentServer = new BaseAgentsServer();
        await global.agentServer.start();

        return NextResponse.json({
          success: true,
          message: 'Agent server started successfully',
          health: global.agentServer.getSystemHealth()
        });

      case 'stop':
        if (!global.agentServer) {
          return NextResponse.json({ 
            message: 'Agent server not running'
          });
        }

        await global.agentServer.stop();
        global.agentServer = undefined;

        return NextResponse.json({
          success: true,
          message: 'Agent server stopped successfully'
        });

      case 'restart':
        if (global.agentServer) {
          await global.agentServer.stop();
        }
        
        global.agentServer = new BaseAgentsServer();
        await global.agentServer.start();

        return NextResponse.json({
          success: true,
          message: 'Agent server restarted successfully',
          health: global.agentServer.getSystemHealth()
        });

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Use start, stop, or restart'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error managing agent server:', error);
    return NextResponse.json({ 
      error: 'Failed to manage agent server',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
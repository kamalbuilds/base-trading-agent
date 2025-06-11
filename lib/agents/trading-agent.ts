import { DecodedMessage } from '@xmtp/node-sdk';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseAgent } from './base-agent';
import { v4 as uuidv4 } from 'uuid';
import {
  TradingAgentConfig,
  AgentContext,
  AgentResponse,
  Portfolio,
  TokenBalance,
  TradeRequest,
  PriceAlert,
  PerformanceMetrics,
} from '../types';

/**
 * TradingAgent handles DeFi operations and trading activities
 */
export class TradingAgent extends BaseAgent {
  private portfolios: Map<string, Portfolio> = new Map();
  private priceAlerts: Map<string, PriceAlert> = new Map();
  private tradeHistory: Map<string, TradeRequest[]> = new Map();

  constructor(config: TradingAgentConfig) {
    super(config);
  }

  protected initializeTools(): void {
    this.tools.push(
      new DynamicStructuredTool({
        name: 'get_portfolio',
        description: 'Get user portfolio information including token balances and performance',
        schema: z.object({
          address: z.string(),
        }),
        func: async ({ address }) => {
          const portfolio = await this.getPortfolio(address);
          return `Portfolio value: $${portfolio.totalValue.toFixed(2)}. Tokens: ${portfolio.tokens.length}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'execute_trade',
        description: 'Execute a token swap on Base network',
        schema: z.object({
          fromToken: z.string(),
          toToken: z.string(),
          amount: z.number(),
          userAddress: z.string(),
        }),
        func: async ({ fromToken, toToken, amount, userAddress }) => {
          const result = await this.executeTrade(fromToken, toToken, amount, userAddress);
          return `Trade executed: ${amount} ${fromToken} → ${toToken}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'set_price_alert',
        description: 'Set a price alert for a token',
        schema: z.object({
          tokenSymbol: z.string(),
          condition: z.enum(['above', 'below']),
          targetPrice: z.number(),
          userAddress: z.string(),
        }),
        func: async ({ tokenSymbol, condition, targetPrice, userAddress }) => {
          const alert = await this.setPriceAlert(tokenSymbol, condition, targetPrice, userAddress);
          return `Price alert set: ${tokenSymbol} ${condition} $${targetPrice}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'get_token_price',
        description: 'Get current price for a token',
        schema: z.object({
          symbol: z.string(),
        }),
        func: async ({ symbol }) => {
          const price = await this.getTokenPrice(symbol);
          return `${symbol}: $${price.toFixed(4)}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'analyze_market',
        description: 'Analyze market trends and provide insights',
        schema: z.object({
          tokens: z.array(z.string()),
        }),
        func: async ({ tokens }) => {
          const analysis = await this.analyzeMarket(tokens);
          return `Market analysis: ${analysis.summary}`;
        },
      })
    );
  }

  protected async handleMessage(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    const content = message.content.toLowerCase();

    if (this.isTradingQuery(content)) {
      return await this.handleTradingRequest(message, context);
    } else if (this.isPortfolioQuery(content)) {
      return await this.handlePortfolioRequest(message, context);
    } else if (this.isPriceQuery(content)) {
      return await this.handlePriceRequest(message, context);
    }

    // Process with LLM for complex queries
    const response = await this.processWithLLM(message.content, context);

    return {
      message: response,
      metadata: { handledBy: 'trading-agent' }
    };
  }

  protected async shouldHandleMessage(message: DecodedMessage, context: AgentContext): Promise<boolean> {
    const content = message.content.toLowerCase();
    const tradingKeywords = [
      'trade', 'swap', 'buy', 'sell', 'defi', 'token', 'price', 'portfolio', 
      'balance', 'uniswap', 'dex', 'yield', 'liquidity', 'farming'
    ];
    
    return tradingKeywords.some(keyword => content.includes(keyword));
  }

  protected async suggestNextAgent(message: DecodedMessage, context: AgentContext): Promise<string> {
    const content = message.content.toLowerCase();
    
    if (content.includes('event') || content.includes('payment') || content.includes('split')) return 'utility';
    if (content.includes('game') || content.includes('play')) return 'gaming';
    if (content.includes('social') || content.includes('content')) return 'social';
    
    return 'master';
  }

  private async getPortfolio(address: string): Promise<Portfolio> {
    // In production, this would query real DeFi protocols and token contracts
    const mockTokens: TokenBalance[] = [
      {
        symbol: 'ETH',
        address: '0x0000000000000000000000000000000000000000',
        balance: 2.5,
        value: 8750,
        price: 3500,
        change24h: 2.3
      },
      {
        symbol: 'USDC',
        address: '0xa0b86a33e6ba5b5c3d3f0a8d99f3c8b6e5b7c8e0',
        balance: 1000,
        value: 1000,
        price: 1.0,
        change24h: 0.1
      }
    ];

    const totalValue = mockTokens.reduce((sum, token) => sum + token.value, 0);
    
    const performance: PerformanceMetrics = {
      totalReturn: 15.6,
      dailyChange: 2.1,
      weeklyChange: -1.2,
      monthlyChange: 8.4,
      volatility: 12.3
    };

    const portfolio: Portfolio = {
      address,
      tokens: mockTokens,
      totalValue,
      lastUpdated: new Date(),
      performance
    };

    this.portfolios.set(address, portfolio);
    return portfolio;
  }

  private async executeTrade(fromToken: string, toToken: string, amount: number, userAddress: string): Promise<any> {
    // In production, this would integrate with Uniswap, 1inch, or other DEX aggregators
    const tradeId = uuidv4();
    const estimatedOutput = amount * 0.997; // Mock 0.3% fee
    
    const trade: TradeRequest = {
      fromToken,
      toToken,
      amount,
      slippage: 0.5,
      deadline: Date.now() + 1200000, // 20 minutes
      userAddress
    };

    const userTrades = this.tradeHistory.get(userAddress) || [];
    userTrades.push(trade);
    this.tradeHistory.set(userAddress, userTrades);

    this.logger.info('Trade executed', { tradeId, fromToken, toToken, amount, userAddress });

    return {
      tradeId,
      estimatedOutput,
      status: 'pending'
    };
  }

  private async setPriceAlert(tokenSymbol: string, condition: 'above' | 'below', targetPrice: number, userAddress: string): Promise<PriceAlert> {
    const alert: PriceAlert = {
      id: uuidv4(),
      tokenSymbol,
      condition,
      targetPrice,
      isActive: true,
      createdBy: userAddress
    };

    this.priceAlerts.set(alert.id, alert);
    
    this.logger.info('Price alert set', { alertId: alert.id, tokenSymbol, condition, targetPrice });
    
    return alert;
  }

  private async getTokenPrice(symbol: string): Promise<number> {
    // In production, this would query real price feeds like Chainlink, CoinGecko, etc.
    const mockPrices: Record<string, number> = {
      'ETH': 3500.25,
      'BTC': 67000.50,
      'USDC': 1.00,
      'USDT': 0.999,
      'DAI': 1.001,
      'WETH': 3500.25,
      'UNI': 12.45,
      'AAVE': 165.30
    };

    return mockPrices[symbol.toUpperCase()] || 0;
  }

  private async analyzeMarket(tokens: string[]): Promise<{ summary: string; trends: Record<string, string> }> {
    // In production, this would use real market data and analytics
    const trends: Record<string, string> = {};
    
    for (const token of tokens) {
      const randomTrend = Math.random();
      if (randomTrend > 0.6) {
        trends[token] = 'bullish';
      } else if (randomTrend < 0.4) {
        trends[token] = 'bearish';
      } else {
        trends[token] = 'neutral';
      }
    }

    const summary = `Market showing mixed signals. ${Object.values(trends).filter(t => t === 'bullish').length} bullish, ${Object.values(trends).filter(t => t === 'bearish').length} bearish trends detected.`;

    return { summary, trends };
  }

  private isTradingQuery(content: string): boolean {
    return ['trade', 'swap', 'buy', 'sell', 'exchange'].some(keyword => content.includes(keyword));
  }

  private isPortfolioQuery(content: string): boolean {
    return ['portfolio', 'balance', 'holdings', 'assets'].some(keyword => content.includes(keyword));
  }

  private isPriceQuery(content: string): boolean {
    return ['price', 'value', 'cost', 'worth', 'alert'].some(keyword => content.includes(keyword));
  }

  private async handleTradingRequest(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    return {
      message: "I can help you execute trades on Base! Please specify which tokens you'd like to swap and the amount. I'll handle the transaction routing and execution.",
      actions: [{
        type: 'transaction',
        payload: { requiresApproval: true }
      }],
      metadata: { handledBy: 'trading-execution' }
    };
  }

  private async handlePortfolioRequest(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    return {
      message: "Let me fetch your portfolio information. I'll show your token balances, total value, and performance metrics.",
      metadata: { handledBy: 'portfolio-analysis' }
    };
  }

  private async handlePriceRequest(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    return {
      message: "I can provide real-time token prices and set up price alerts for you. Which token would you like to check?",
      metadata: { handledBy: 'price-monitoring' }
    };
  }

  protected getSystemPrompt(): string {
    return `You are a Trading Agent specialized in DeFi operations on Base network.

Your capabilities include:
- Portfolio management and tracking
- Token swaps and trading execution
- Price monitoring and alerts
- Market analysis and insights
- Yield farming opportunities
- Risk assessment

You help users:
1. Check portfolio balances and performance
2. Execute token swaps on DEXs like Uniswap
3. Set up price alerts and monitoring
4. Analyze market trends and opportunities
5. Manage DeFi positions and yield farming

Always prioritize user safety and provide clear information about risks, fees, and slippage. Verify transaction details before execution and explain market conditions clearly.

Current market context: Operating on Base mainnet with real DeFi protocols and live price data.`;
  }
} 
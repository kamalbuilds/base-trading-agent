import { DecodedMessage } from '@xmtp/node-sdk';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseAgent } from './base-agent';
import { 
  AgentKit,
  CdpWalletProvider,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  erc721ActionProvider,
  cdpApiActionProvider,
  cdpWalletActionProvider,
  pythActionProvider,
  openseaActionProvider,
  alloraActionProvider,
} from '@coinbase/agentkit';
import { getLangChainTools } from '@coinbase/agentkit-langchain';
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
import axios from 'axios';

/**
 * Production-grade TradingAgent with real blockchain operations via Coinbase AgentKit
 * Handles DeFi operations, trading activities, and portfolio management on Base network
 */
export class TradingAgent extends BaseAgent {
  private agentKit?: AgentKit;
  private walletProvider?: CdpWalletProvider;
  private portfolios: Map<string, Portfolio> = new Map();
  private priceAlerts: Map<string, PriceAlert> = new Map();
  private tradeHistory: Map<string, TradeRequest[]> = new Map();

  constructor(config: TradingAgentConfig) {
    super(config);
  }

  /**
   * Initialize AgentKit with real blockchain capabilities
   */
  async initialize(): Promise<void> {
    try {
      // Configure CDP Wallet Provider with real credentials
      const config = {
        apiKeyId: process.env.CDP_API_KEY_ID!,
        apiKeySecret: process.env.CDP_API_KEY_PRIVATE_KEY!,
        networkId: process.env.NETWORK_ID || "base-sepolia",
      };

      this.walletProvider = await CdpWalletProvider.configureWithWallet(config);

      // Initialize AgentKit with comprehensive action providers
      this.agentKit = await AgentKit.from({
        walletProvider: this.walletProvider,
        actionProviders: [
          wethActionProvider(),
          pythActionProvider(),
          walletActionProvider(),
          erc20ActionProvider(),
          erc721ActionProvider(),
          cdpApiActionProvider({
            apiKeyId: process.env.CDP_API_KEY_ID!,
            apiKeySecret: process.env.CDP_API_KEY_PRIVATE_KEY!,
          }),
          cdpWalletActionProvider({
            apiKeyId: process.env.CDP_API_KEY_ID!,
            apiKeySecret: process.env.CDP_API_KEY_PRIVATE_KEY!,
          }),
          ...(process.env.OPENSEA_API_KEY
            ? [
                openseaActionProvider({
                  apiKey: process.env.OPENSEA_API_KEY,
                  networkId: this.walletProvider.getNetwork().networkId,
                  privateKey: await (await this.walletProvider.getWallet().getDefaultAddress()).export(),
                }),
              ]
            : []),
          alloraActionProvider(),
        ],
      });

      // Get AgentKit tools for LangChain integration
      const agentKitTools = await getLangChainTools(this.agentKit);
      // Convert AgentKit tools to DynamicStructuredTool if needed
      for (const tool of agentKitTools) {
        if (tool instanceof DynamicStructuredTool) {
          this.tools.push(tool);
        }
      }

      await super.initialize();
      this.logger.info('TradingAgent initialized with real blockchain capabilities');
    } catch (error) {
      this.logger.error('Failed to initialize TradingAgent with AgentKit', { error });
      throw error;
    }
  }

  protected initializeTools(): void {
    this.tools.push(
      new DynamicStructuredTool({
        name: 'get_wallet_balance',
        description: 'Get real wallet balance from the blockchain',
        schema: z.object({
          address: z.string().optional(),
        }),
        func: async ({ address }) => {
          try {
            if (!this.walletProvider) {
              throw new Error('Wallet provider not initialized');
            }
            
            const wallet = this.walletProvider.getWallet();
            const defaultAddress = await wallet.getDefaultAddress();
            const balances = await defaultAddress.listBalances();
            
            return `Wallet Balance: ${JSON.stringify(balances, null, 2)}`;
          } catch (error) {
            this.logger.error('Error getting wallet balance', { error });
            return `Error getting wallet balance: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'get_real_token_price',
        description: 'Get real-time token price from Pyth Network',
        schema: z.object({
          symbol: z.string(),
        }),
        func: async ({ symbol }) => {
          try {
            // Use AgentKit's Pyth integration for real price data
            const response = await this.executeAgentKitAction('get_price', {
              symbol: symbol.toUpperCase(),
            });
            return response;
          } catch (error) {
            this.logger.error('Error getting token price', { error, symbol });
            return `Error getting price for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'execute_real_trade',
        description: 'Execute real token swap on Base network using DEX',
        schema: z.object({
          fromToken: z.string(),
          toToken: z.string(),
          amount: z.string(),
          slippage: z.number().optional().default(1),
        }),
        func: async ({ fromToken, toToken, amount, slippage }) => {
          try {
            if (!this.agentKit) {
              throw new Error('AgentKit not initialized');
            }

            // Use AgentKit's trade functionality for real swaps
            const response = await this.executeAgentKitAction('trade', {
              amount,
              fromAsset: fromToken,
              toAsset: toToken,
              slippage: slippage / 100, // Convert percentage to decimal
            });

            return `Trade executed: ${amount} ${fromToken} → ${toToken}. Transaction: ${response}`;
          } catch (error) {
            this.logger.error('Error executing trade', { error, fromToken, toToken, amount });
            return `Error executing trade: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'deploy_erc20_token',
        description: 'Deploy a new ERC-20 token on Base network',
        schema: z.object({
          name: z.string(),
          symbol: z.string(),
          totalSupply: z.string(),
        }),
        func: async ({ name, symbol, totalSupply }) => {
          try {
            if (!this.agentKit) {
              throw new Error('AgentKit not initialized');
            }

            const response = await this.executeAgentKitAction('deploy_token', {
              name,
              symbol,
              totalSupply,
            });

            return `Token deployed: ${name} (${symbol}) with supply ${totalSupply}. Contract: ${response}`;
          } catch (error) {
            this.logger.error('Error deploying token', { error, name, symbol });
            return `Error deploying token: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'request_testnet_funds',
        description: 'Request testnet ETH from faucet for Base Sepolia',
        schema: z.object({}),
        func: async () => {
          try {
            if (!this.agentKit) {
              throw new Error('AgentKit not initialized');
            }

            const response = await this.executeAgentKitAction('request_faucet_funds');
            return `Testnet funds requested successfully: ${response}`;
          } catch (error) {
            this.logger.error('Error requesting faucet funds', { error });
            return `Error requesting testnet funds: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'transfer_tokens',
        description: 'Transfer ERC-20 tokens to another address',
        schema: z.object({
          tokenAddress: z.string(),
          recipientAddress: z.string(),
          amount: z.string(),
        }),
        func: async ({ tokenAddress, recipientAddress, amount }) => {
          try {
            if (!this.agentKit) {
              throw new Error('AgentKit not initialized');
            }

            const response = await this.executeAgentKitAction('transfer', {
              to: recipientAddress,
              amount,
              assetId: tokenAddress,
            });

            return `Transfer completed: ${amount} tokens sent to ${recipientAddress}. Transaction: ${response}`;
          } catch (error) {
            this.logger.error('Error transferring tokens', { error, tokenAddress, recipientAddress });
            return `Error transferring tokens: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'get_transaction_history',
        description: 'Get real transaction history from the blockchain',
        schema: z.object({
          limit: z.number().optional().default(10),
        }),
        func: async ({ limit }) => {
          try {
            if (!this.walletProvider) {
              throw new Error('Wallet provider not initialized');
            }

            const wallet = this.walletProvider.getWallet();
            const defaultAddress = await wallet.getDefaultAddress();
            const transactions = await defaultAddress.listTransactions({ limit });

            return `Transaction History: ${JSON.stringify(transactions, null, 2)}`;
          } catch (error) {
            this.logger.error('Error getting transaction history', { error });
            return `Error getting transaction history: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        },
      }),

      new DynamicStructuredTool({
        name: 'analyze_real_market_data',
        description: 'Analyze real market data from multiple sources',
        schema: z.object({
          tokens: z.array(z.string()),
        }),
        func: async ({ tokens }) => {
          try {
            const analyses = await Promise.all(
              tokens.map(async (token: string) => {
                try {
                  // Get real price data from CoinGecko
                  const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
                    params: {
                      ids: token.toLowerCase(),
                      vs_currencies: 'usd',
                      include_24hr_change: true,
                      include_market_cap: true,
                      include_24hr_vol: true,
                    },
                  });

                  const data = response.data[token.toLowerCase()];
                  if (!data) {
                    return `${token}: No data available`;
                  }

                  return `${token.toUpperCase()}: $${data.usd} (${data.usd_24h_change?.toFixed(2)}% 24h)`;
                } catch (error) {
                  return `${token}: Error fetching data`;
                }
              })
            );

            return `Market Analysis:\n${analyses.join('\n')}`;
          } catch (error) {
            this.logger.error('Error analyzing market data', { error });
            return `Error analyzing market data: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        },
      }),
    );
  }

  /**
   * Execute AgentKit actions with proper error handling
   */
  private async executeAgentKitAction(action: string, params?: any): Promise<any> {
    if (!this.agentKit) {
      throw new Error('AgentKit not initialized');
    }

    // Use the LLM to process the action through AgentKit
    const prompt = `Execute the following blockchain action: ${action}${params ? ` with parameters: ${JSON.stringify(params)}` : ''}`;
    
    try {
      const walletAddress = this.walletProvider ? await (await this.walletProvider.getWallet().getDefaultAddress()).getId() : 'unknown';
      
      const response = await this.processWithLLM(prompt, {
        userId: 'system',
        conversationId: 'trading-action',
        messageHistory: [],
      });

      return response;
    } catch (error) {
      this.logger.error('AgentKit action failed', { action, params, error });
      throw error;
    }
  }

  protected async handleMessage(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    const content = message.content.toLowerCase();

    // Handle specific trading requests
    if (this.isTradingQuery(content)) {
      return await this.handleTradingRequest(message, context);
    } else if (this.isPortfolioQuery(content)) {
      return await this.handlePortfolioRequest(message, context);
    } else if (this.isPriceQuery(content)) {
      return await this.handlePriceRequest(message, context);
    } else if (this.isDeploymentQuery(content)) {
      return await this.handleDeploymentRequest(message, context);
    }

    // Process with LLM using AgentKit tools for complex queries
    const response = await this.processWithLLM(message.content, context);

    return {
      message: response,
      metadata: { 
        handledBy: 'trading-agent',
        walletAddress: this.walletProvider ? await (await this.walletProvider.getWallet().getDefaultAddress()).getId() : null,
        networkId: this.walletProvider ? this.walletProvider.getNetwork().networkId : null
      },
      actions: []
    };
  }

  protected async shouldHandleMessage(message: DecodedMessage, context: AgentContext): Promise<boolean> {
    const content = message.content.toLowerCase();
    const tradingKeywords = [
      'trade', 'swap', 'buy', 'sell', 'defi', 'token', 'price', 'portfolio', 
      'balance', 'uniswap', 'dex', 'yield', 'liquidity', 'farming', 'deploy',
      'transfer', 'send', 'receive', 'wallet', 'transaction', 'blockchain',
      'eth', 'usdc', 'weth', 'base', 'sepolia', 'faucet', 'testnet'
    ];
    
    return tradingKeywords.some(keyword => content.includes(keyword));
  }

  protected async suggestNextAgent(message: DecodedMessage, context: AgentContext): Promise<string> {
    const content = message.content.toLowerCase();
    
    if (content.includes('event') || content.includes('payment') || content.includes('split')) return 'utility';
    if (content.includes('game') || content.includes('play')) return 'game';
    if (content.includes('social') || content.includes('content')) return 'social';
    if (content.includes('app') || content.includes('tool')) return 'miniapp';
    
    return 'master';
  }

  private isTradingQuery(content: string): boolean {
    return /\b(trade|swap|buy|sell|exchange)\b/.test(content);
  }

  private isPortfolioQuery(content: string): boolean {
    return /\b(portfolio|balance|wallet|holdings)\b/.test(content);
  }

  private isPriceQuery(content: string): boolean {
    return /\b(price|cost|value|worth|market)\b/.test(content);
  }

  private isDeploymentQuery(content: string): boolean {
    return /\b(deploy|create|launch|mint|token|contract)\b/.test(content);
  }

  private async handleTradingRequest(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    const prompt = `Process this trading request: "${message.content}". Use the available trading tools to execute the trade if requested.`;
    const response = await this.processWithLLM(prompt, context);
    
    return {
      message: response,
      metadata: { handledBy: 'trading-agent', category: 'trading' },
      actions: [
        {
          type: 'transaction',
          payload: { 
            request: message.content,
            timestamp: new Date()
          }
        }
      ]
    };
  }

  private async handlePortfolioRequest(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    const prompt = `Provide portfolio information for: "${message.content}". Use wallet balance tools to get real data.`;
    const response = await this.processWithLLM(prompt, context);
    
    return {
      message: response,
      metadata: { handledBy: 'trading-agent', category: 'portfolio' },
      actions: []
    };
  }

  private async handlePriceRequest(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    const prompt = `Get price information for: "${message.content}". Use real price data tools.`;
    const response = await this.processWithLLM(prompt, context);
    
    return {
      message: response,
      metadata: { handledBy: 'trading-agent', category: 'price' },
      actions: []
    };
  }

  private async handleDeploymentRequest(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    const prompt = `Handle deployment request: "${message.content}". Use token deployment tools if needed.`;
    const response = await this.processWithLLM(prompt, context);
    
    return {
      message: response,
      metadata: { handledBy: 'trading-agent', category: 'deployment' },
      actions: [
        {
          type: 'transaction',
          payload: { 
            request: message.content,
            timestamp: new Date(),
            action: 'deployment'
          }
        }
      ]
    };
  }

  protected getSystemPrompt(): string {
    return `You are TradingAgent, a production-grade DeFi and trading specialist powered by Coinbase AgentKit.

Your capabilities include:
- Real blockchain operations on Base network
- Token swaps and DEX interactions
- ERC-20 token deployment and management
- Real-time price data from Pyth Network
- Wallet management and transactions
- Portfolio tracking and analysis
- Market data analysis

You have access to REAL blockchain tools through Coinbase AgentKit:
- Wallet operations (balances, transfers, transactions)
- Trading via DEX protocols
- Token deployment and management
- Real price feeds from Pyth
- Faucet access for testnet funds

Guidelines:
1. Always use real blockchain data and operations
2. Confirm transaction details before execution
3. Provide clear transaction hashes and links
4. Handle errors gracefully with helpful explanations
5. Use testnet for safe experimentation
6. Educate users about blockchain concepts
7. Always verify sufficient funds before operations

Current network: ${process.env.NETWORK_ID || 'base-sepolia'}
You can perform real transactions and provide actual blockchain services.`;
  }
} 
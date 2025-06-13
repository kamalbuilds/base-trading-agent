// NOTE: This agent now uses only CdpV2EvmWalletProvider for wallet management (Coinbase AgentKit v2)
import { DecodedMessage } from '@xmtp/browser-sdk';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseAgent } from './base-agent';
import { 
  AgentKit,
  CdpV2EvmWalletProvider,
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
import { HumanMessage } from '@langchain/core/messages';
import { MemorySaver } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
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
 * Uses createReactAgent for proper LLM + tool integration
 */
export class TradingAgent extends BaseAgent {
  private agentKit?: AgentKit;
  private walletProvider?: CdpV2EvmWalletProvider;
  private walletAddress?: string;
  private reactAgent?: ReturnType<typeof createReactAgent>;
  private memory?: MemorySaver;
  private llmModel?: ChatOpenAI;
  private portfolios: Map<string, Portfolio> = new Map();
  private priceAlerts: Map<string, PriceAlert> = new Map();
  private tradeHistory: Map<string, TradeRequest[]> = new Map();

  constructor(config: TradingAgentConfig) {
    super(config);
  }

  /**
   * Initialize AgentKit with createReactAgent for proper LLM integration
   */
  async initialize(): Promise<void> {
    try {
      console.log('[TradingAgent] Initializing TradingAgent...');

      // Initialize LLM
      this.llmModel = new ChatOpenAI({
        model: "gpt-4o",
        temperature: 0.1,
      });

      // Configure CDP V2 EVM Wallet Provider with real credentials
      const cdpWalletConfig = {
        apiKeyId: process.env.CDP_API_KEY_ID!,
        apiKeySecret: process.env.CDP_API_KEY_SECRET!,
        walletSecret: process.env.CDP_WALLET_SECRET!,
        idempotencyKey: process.env.IDEMPOTENCY_KEY,
        address: process.env.ADDRESS as `0x${string}` | undefined,
        networkId: process.env.NETWORK_ID!,
      };

      this.walletProvider = await CdpV2EvmWalletProvider.configureWithWallet(cdpWalletConfig);
      this.walletAddress = this.walletProvider.getAddress();

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
            apiKeySecret: process.env.CDP_API_KEY_SECRET!,
          }),
          cdpWalletActionProvider({
            apiKeyId: process.env.CDP_API_KEY_ID!,
            apiKeySecret: process.env.CDP_API_KEY_SECRET!,
          }),
          ...(process.env.OPENSEA_API_KEY
            ? [
                openseaActionProvider({
                  apiKey: process.env.OPENSEA_API_KEY,
                  networkId: process.env.NETWORK_ID!,
                  privateKey: process.env.WALLET_PRIVATE_KEY!,
                }),
              ]
            : []),
          alloraActionProvider(),
        ],
      });

      // Get AgentKit tools for LangChain integration
      const agentKitTools = await getLangChainTools(this.agentKit);
      
      // Add custom tools
      this.initializeTools();
      const allTools = [...agentKitTools, ...this.tools];

      // Initialize memory for conversation context
      this.memory = new MemorySaver();

      // Create React Agent with LLM, tools, and memory
      this.reactAgent = createReactAgent({
        llm: this.llmModel,
        tools: allTools,
        checkpointSaver: this.memory,
        messageModifier: this.getSystemPrompt(),
      });

      await super.initialize();
      this.logger.info('TradingAgent initialized with createReactAgent and real blockchain capabilities');
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
            const balance = await this.walletProvider.getBalance();
            const walletAddr = address || this.walletProvider.getAddress();
            const balanceEth = Number(balance) / 1e18;
            return `Wallet Balance for ${walletAddr}: ${balanceEth} ETH/BASE`;
          } catch (error) {
            this.logger.error('Error getting wallet balance', { error });
            return `Error getting wallet balance: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
            const walletAddr = this.walletProvider.getAddress();
            const apiKey = process.env.BASESCAN_API_KEY;
            const url = `https://api.basescan.org/api?module=account&action=txlist&address=${walletAddr}&sort=desc&page=1&offset=${limit}${apiKey ? `&apikey=${apiKey}` : ''}`;
            const resp = await axios.get(url);
            if (resp.data.status !== '1') {
              throw new Error(resp.data.message || 'Failed to fetch transaction history');
            }
            const txs = resp.data.result;
            const formatted = txs.map((tx: any) => `Hash: ${tx.hash}\nFrom: ${tx.from}\nTo: ${tx.to}\nValue: ${Number(tx.value) / 1e18} ETH/BASE\nBlock: ${tx.blockNumber}\nTime: ${new Date(Number(tx.timeStamp) * 1000).toLocaleString()}\nStatus: ${tx.isError === '0' ? 'Success' : 'Failed'}`).join('\n\n');
            return `Last ${txs.length} transactions for ${walletAddr}:\n\n${formatted}`;
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

  protected async handleMessage(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    try {
      if (!this.reactAgent) {
        throw new Error('React agent not initialized');
      }

      const messageContent = typeof message.content === 'string' ? message.content : '';
      const threadId = context.conversationId || 'default';

      // Use React Agent to process the message with proper LLM + tool integration
      let response = '';
      const stream = await this.reactAgent.stream(
        { messages: [new HumanMessage(messageContent)] },
        { configurable: { thread_id: threadId } }
      );

      for await (const chunk of stream) {
        if (chunk && typeof chunk === 'object' && 'agent' in chunk) {
          const agentChunk = chunk as {
            agent: { messages: Array<{ content: unknown }> };
          };
          response += String(agentChunk.agent.messages[0].content) + '\n';
        }
      }

      return {
        message: response.trim() || 'I can help you with DeFi operations, trading, and portfolio management. What would you like to do?',
        metadata: { 
          handledBy: 'trading-agent',
          walletAddress: this.walletAddress || null,
          networkId: process.env.NETWORK_ID || null,
          usedReactAgent: true
        },
        actions: []
      };
    } catch (error) {
      this.logger.error('Error in handleMessage', { error });
      return {
        message: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        metadata: { handledBy: 'trading-agent', error: true },
        actions: []
      };
    }
  }

  protected async shouldHandleMessage(message: DecodedMessage, context: AgentContext): Promise<boolean> {
    const content = typeof message.content === 'string' ? message.content.toLowerCase() : '';
    const tradingKeywords = [
      'trade', 'swap', 'buy', 'sell', 'defi', 'token', 'price', 'portfolio', 
      'balance', 'uniswap', 'dex', 'yield', 'liquidity', 'farming', 'deploy',
      'transfer', 'send', 'receive', 'wallet', 'transaction', 'blockchain',
      'eth', 'usdc', 'weth', 'base', 'sepolia', 'faucet', 'testnet'
    ];
    
    return tradingKeywords.some(keyword => content.includes(keyword));
  }

  protected async suggestNextAgent(message: DecodedMessage, context: AgentContext): Promise<string> {
    const content = typeof message.content === 'string' ? message.content.toLowerCase() : '';
    
    if (content.includes('event') || content.includes('payment') || content.includes('split')) return 'utility';
    if (content.includes('game') || content.includes('play')) return 'game';
    if (content.includes('social') || content.includes('content')) return 'social';
    if (content.includes('app') || content.includes('tool')) return 'miniapp';
    
    return 'master';
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
Current wallet: ${this.walletAddress || 'Not initialized'}

You can perform real transactions and provide actual blockchain services. Use the available tools to help users with their DeFi and trading needs.`;
  }
} 
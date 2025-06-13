// NOTE: This agent is ready for EVM wallet management with CdpV2EvmWalletProvider (Coinbase AgentKit v2)
import { DecodedMessage } from '@xmtp/node-sdk';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseAgent } from './base-agent';
import { v4 as uuidv4 } from 'uuid';
import { CdpV2EvmWalletProvider } from '@coinbase/agentkit';
import {
  GamingAgentConfig,
  AgentContext,
  AgentResponse,
  GameSession,
  GamePlayer,
  GameType,
  GameBet,
} from '../types';

/**
 * GameAgent handles interactive multiplayer games and entertainment
 */
export class GameAgent extends BaseAgent {
  private activeGames: Map<string, GameSession> = new Map();
  private gameTypes: Map<string, GameType> = new Map();
  private playerStats: Map<string, any> = new Map();

  constructor(config: GamingAgentConfig) {
    super(config);
    this.initializeGameTypes();
  }

  protected initializeTools(): void {
    this.tools.push(
      new DynamicStructuredTool({
        name: 'start_game',
        description: 'Start a new game session with specified participants',
        schema: z.object({
          gameType: z.string(),
          players: z.array(z.string()),
        }),
        func: async ({ gameType, players }) => {
          const session = await this.startGame(gameType, players);
          return `Game started: ${gameType} with ${players.length} players. Game ID: ${session.id}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'join_game',
        description: 'Join an existing game session',
        schema: z.object({
          gameId: z.string(),
          playerAddress: z.string(),
        }),
        func: async ({ gameId, playerAddress }) => {
          await this.joinGame(gameId, playerAddress);
          return `Joined game ${gameId}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'make_move',
        description: 'Make a move in an active game',
        schema: z.object({
          gameId: z.string(),
          playerAddress: z.string(),
          move: z.any(),
        }),
        func: async ({ gameId, playerAddress, move }) => {
          const result = await this.makeMove(gameId, playerAddress, move);
          return `Move made: ${move}. ${result.message}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'place_bet',
        description: 'Place a bet on game outcome',
        schema: z.object({
          gameId: z.string(),
          playerAddress: z.string(),
          amount: z.number(),
          prediction: z.any(),
        }),
        func: async ({ gameId, playerAddress, amount, prediction }) => {
          const bet = await this.placeBet(gameId, playerAddress, amount, prediction);
          return `Bet placed: ${amount} ETH on ${prediction}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'get_game_status',
        description: 'Get current status of a game',
        schema: z.object({
          gameId: z.string(),
        }),
        func: async ({ gameId }) => {
          const status = await this.getGameStatus(gameId);
          return `Game Status: ${status.status}. Score: ${JSON.stringify(status.scores)}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'list_available_games',
        description: 'List all available game types',
        schema: z.object({}),
        func: async () => {
          const games = Array.from(this.gameTypes.values());
          return `Available games: ${games.map(g => g.name).join(', ')}`;
        },
      })
    );
  }

  protected async handleMessage(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    const content = message.content.toLowerCase();

    if (this.isGameStartRequest(content)) {
      return await this.handleGameStart(message, context);
    } else if (this.isGameMove(content)) {
      return await this.handleGameMove(message, context);
    } else if (this.isBettingRequest(content)) {
      return await this.handleBetting(message, context);
    }

    // Process with LLM for complex queries
    const response = await this.processWithLLM(message.content, context);

    return {
      message: response,
      metadata: { handledBy: 'game-agent' }
    };
  }

  protected async shouldHandleMessage(message: DecodedMessage, context: AgentContext): Promise<boolean> {
    const content = message.content.toLowerCase();
    const gameKeywords = [
      'game', 'play', 'trivia', 'quiz', 'bet', 'wager', 'challenge',
      'compete', 'tournament', 'fun', 'entertainment'
    ];
    
    return gameKeywords.some(keyword => content.includes(keyword));
  }

  protected async suggestNextAgent(message: DecodedMessage, context: AgentContext): Promise<string> {
    const content = message.content.toLowerCase();
    
    if (content.includes('trade') || content.includes('defi')) return 'trading';
    if (content.includes('event') || content.includes('payment')) return 'utility';
    if (content.includes('social') || content.includes('content')) return 'social';
    
    return 'master';
  }

  private initializeGameTypes(): void {
    const gameTypes: GameType[] = [
      {
        id: 'trivia',
        name: 'Trivia Quiz',
        description: 'Answer questions to earn points',
        minPlayers: 2,
        maxPlayers: 10,
        duration: 15,
        category: 'trivia'
      },
      {
        id: 'word-chain',
        name: 'Word Chain',
        description: 'Build words from the last letter of previous word',
        minPlayers: 2,
        maxPlayers: 6,
        duration: 10,
        category: 'word'
      },
      {
        id: 'number-guess',
        name: 'Number Guessing',
        description: 'Guess the number in the fewest attempts',
        minPlayers: 2,
        maxPlayers: 8,
        duration: 5,
        category: 'number'
      },
      {
        id: 'crypto-prediction',
        name: 'Crypto Price Prediction',
        description: 'Predict crypto price movements',
        minPlayers: 2,
        maxPlayers: 20,
        duration: 30,
        category: 'strategy'
      }
    ];

    gameTypes.forEach(game => this.gameTypes.set(game.id, game));
  }

  private async startGame(gameTypeId: string, playerAddresses: string[]): Promise<GameSession> {
    const gameType = this.gameTypes.get(gameTypeId);
    if (!gameType) {
      throw new Error(`Game type ${gameTypeId} not found`);
    }

    if (playerAddresses.length < gameType.minPlayers || playerAddresses.length > gameType.maxPlayers) {
      throw new Error(`Invalid number of players. Required: ${gameType.minPlayers}-${gameType.maxPlayers}`);
    }

    const players: GamePlayer[] = playerAddresses.map(address => ({
      address,
      score: 0,
      isActive: true,
      joinedAt: new Date()
    }));

    const session: GameSession = {
      id: uuidv4(),
      gameType: gameTypeId,
      players,
      status: 'waiting',
      currentRound: 1,
      totalRounds: this.calculateRounds(gameType),
      startTime: new Date(),
      scores: {},
      bets: []
    };

    // Initialize scores
    playerAddresses.forEach(address => {
      session.scores[address] = 0;
    });

    this.activeGames.set(session.id, session);
    
    this.logger.info('Game started', { 
      sessionId: session.id, 
      gameType: gameTypeId, 
      players: playerAddresses.length 
    });

    return session;
  }

  private async joinGame(gameId: string, playerAddress: string): Promise<void> {
    const session = this.activeGames.get(gameId);
    if (!session) {
      throw new Error(`Game ${gameId} not found`);
    }

    if (session.status !== 'waiting') {
      throw new Error('Game already started');
    }

    const gameType = this.gameTypes.get(session.gameType)!;
    if (session.players.length >= gameType.maxPlayers) {
      throw new Error('Game is full');
    }

    const newPlayer: GamePlayer = {
      address: playerAddress,
      score: 0,
      isActive: true,
      joinedAt: new Date()
    };

    session.players.push(newPlayer);
    session.scores[playerAddress] = 0;

    this.activeGames.set(gameId, session);
  }

  private async makeMove(gameId: string, playerAddress: string, move: any): Promise<{ success: boolean; message: string }> {
    const session = this.activeGames.get(gameId);
    if (!session) {
      throw new Error(`Game ${gameId} not found`);
    }

    const player = session.players.find(p => p.address === playerAddress);
    if (!player) {
      throw new Error('Player not in game');
    }

    // Process move based on game type
    const result = await this.processMove(session, playerAddress, move);
    
    // Update session
    this.activeGames.set(gameId, session);

    return result;
  }

  private async processMove(session: GameSession, playerAddress: string, move: any): Promise<{ success: boolean; message: string }> {
    const gameType = this.gameTypes.get(session.gameType)!;
    
    switch (gameType.category) {
      case 'trivia':
        return this.processTriviaMove(session, playerAddress, move);
      case 'word':
        return this.processWordMove(session, playerAddress, move);
      case 'number':
        return this.processNumberMove(session, playerAddress, move);
      case 'strategy':
        return this.processStrategyMove(session, playerAddress, move);
      default:
        return { success: false, message: 'Unknown game type' };
    }
  }

  private processTriviaMove(session: GameSession, playerAddress: string, answer: string): { success: boolean; message: string } {
    // Mock trivia logic - in production would have real questions and answers
    const isCorrect = Math.random() > 0.5; // 50% chance for demo
    
    if (isCorrect) {
      session.scores[playerAddress] += 10;
      return { success: true, message: 'Correct! +10 points' };
    } else {
      return { success: false, message: 'Incorrect answer' };
    }
  }

  private processWordMove(session: GameSession, playerAddress: string, word: string): { success: boolean; message: string } {
    // Mock word chain validation
    const isValid = word.length > 2; // Simple validation
    
    if (isValid) {
      session.scores[playerAddress] += word.length;
      return { success: true, message: `Valid word! +${word.length} points` };
    } else {
      return { success: false, message: 'Invalid word' };
    }
  }

  private processNumberMove(session: GameSession, playerAddress: string, guess: number): { success: boolean; message: string } {
    // Mock number guessing
    const targetNumber = 42; // Fixed for demo
    const difference = Math.abs(guess - targetNumber);
    
    if (difference === 0) {
      session.scores[playerAddress] += 100;
      return { success: true, message: 'Perfect! +100 points' };
    } else if (difference <= 5) {
      session.scores[playerAddress] += 20;
      return { success: true, message: 'Close! +20 points' };
    } else {
      return { success: false, message: 'Too far off' };
    }
  }

  private processStrategyMove(session: GameSession, playerAddress: string, prediction: any): { success: boolean; message: string } {
    // Mock crypto prediction
    session.scores[playerAddress] += 5; // Participation points
    return { success: true, message: 'Prediction recorded! +5 points' };
  }

  private async placeBet(gameId: string, playerAddress: string, amount: number, prediction: any): Promise<GameBet> {
    const session = this.activeGames.get(gameId);
    if (!session) {
      throw new Error(`Game ${gameId} not found`);
    }

    const bet: GameBet = {
      id: uuidv4(),
      player: playerAddress,
      amount,
      currency: 'ETH',
      prediction,
    };

    if (!session.bets) {
      session.bets = [];
    }
    
    session.bets.push(bet);
    this.activeGames.set(gameId, session);

    return bet;
  }

  private async getGameStatus(gameId: string): Promise<{ status: string; scores: Record<string, number>; round: number }> {
    const session = this.activeGames.get(gameId);
    if (!session) {
      throw new Error(`Game ${gameId} not found`);
    }

    return {
      status: session.status,
      scores: session.scores,
      round: session.currentRound
    };
  }

  private calculateRounds(gameType: GameType): number {
    // Calculate rounds based on game type and duration
    switch (gameType.category) {
      case 'trivia': return 10;
      case 'word': return 15;
      case 'number': return 5;
      case 'strategy': return 3;
      default: return 5;
    }
  }

  private isGameStartRequest(content: string): boolean {
    return ['start game', 'new game', 'play', 'begin'].some(phrase => content.includes(phrase));
  }

  private isGameMove(content: string): boolean {
    return ['answer', 'guess', 'move', 'play'].some(word => content.includes(word));
  }

  private isBettingRequest(content: string): boolean {
    return ['bet', 'wager', 'stake'].some(word => content.includes(word));
  }

  private async handleGameStart(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    const availableGames = Array.from(this.gameTypes.values()).map(g => g.name).join(', ');
    
    return {
      message: `Let's start a game! Available games: ${availableGames}. Which game would you like to play and with whom?`,
      metadata: { handledBy: 'game-start' }
    };
  }

  private async handleGameMove(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    return {
      message: "I see you want to make a move! Which game are you playing and what's your move?",
      metadata: { handledBy: 'game-move' }
    };
  }

  private async handleBetting(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    return {
      message: "Ready to place a bet? Tell me the game, amount, and what you're betting on!",
      actions: [{
        type: 'transaction',
        payload: { requiresApproval: true }
      }],
      metadata: { handledBy: 'game-betting' }
    };
  }

  protected getSystemPrompt(): string {
    return `You are a Game Agent specialized in interactive multiplayer games and entertainment.

Your capabilities include:
- Running various game types (trivia, word games, number games, strategy)
- Managing multiplayer sessions
- Handling betting and wagering
- Tracking scores and leaderboards
- Creating engaging interactive experiences

Available games:
- Trivia Quiz: Answer questions to earn points
- Word Chain: Build words from previous letters
- Number Guessing: Guess numbers with fewest attempts
- Crypto Prediction: Predict market movements

You help users:
1. Start and join game sessions
2. Play interactive games with friends
3. Place bets on game outcomes
4. Track scores and achievements
5. Discover new games and challenges

Keep games fun, fair, and engaging. Explain rules clearly and provide helpful hints. Ensure all betting is transparent and secure.

Current context: Managing interactive games within XMTP conversations.`;
  }
} 
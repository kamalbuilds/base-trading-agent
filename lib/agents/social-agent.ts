import { DecodedMessage } from '@xmtp/node-sdk';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { BaseAgent } from './base-agent';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import {
  SocialAgentConfig,
  AgentContext,
  AgentResponse,
  CuratedContent,
  ContentSource,
  UserPreferences,
  EngagementMetrics,
} from '../types';

/**
 * SocialAgent handles content curation and community engagement
 */
export class SocialAgent extends BaseAgent {
  private contentSources: Map<string, ContentSource> = new Map();
  private curatedContent: Map<string, CuratedContent[]> = new Map();
  private userPreferences: Map<string, UserPreferences> = new Map();

  constructor(config: SocialAgentConfig) {
    super(config);
    this.initializeContentSources();
  }

  protected initializeTools(): void {
    this.tools.push(
      new DynamicStructuredTool({
        name: 'get_crypto_news',
        description: 'Get latest cryptocurrency news and updates',
        schema: z.object({
          category: z.string().optional(),
          limit: z.number().optional(),
        }),
        func: async ({ category, limit = 5 }) => {
          const news = await this.getCryptoNews(category, limit);
          return `Latest crypto news: ${news.map(n => n.title).join(', ')}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'get_trending_topics',
        description: 'Get trending topics in crypto and DeFi',
        schema: z.object({}),
        func: async () => {
          const trends = await this.getTrendingTopics();
          return `Trending topics: ${trends.join(', ')}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'set_content_preferences',
        description: 'Set user content preferences and interests',
        schema: z.object({
          userAddress: z.string(),
          interests: z.array(z.string()),
          frequency: z.enum(['high', 'medium', 'low']),
        }),
        func: async ({ userAddress, interests, frequency }) => {
          await this.setUserPreferences(userAddress, interests, frequency);
          return `Content preferences updated for ${userAddress}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'get_personalized_feed',
        description: 'Get personalized content feed for user',
        schema: z.object({
          userAddress: z.string(),
          limit: z.number().optional(),
        }),
        func: async ({ userAddress, limit = 10 }) => {
          const feed = await this.getPersonalizedFeed(userAddress, limit);
          return `Personalized feed: ${feed.map(c => c.title).join(', ')}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'recommend_content',
        description: 'Recommend content based on group interests',
        schema: z.object({
          conversationId: z.string(),
          topic: z.string().optional(),
        }),
        func: async ({ conversationId, topic }) => {
          const recommendations = await this.recommendContent(conversationId, topic);
          return `Content recommendations: ${recommendations.map(r => r.title).join(', ')}`;
        },
      }),

      new DynamicStructuredTool({
        name: 'analyze_sentiment',
        description: 'Analyze sentiment of content or messages',
        schema: z.object({
          text: z.string(),
        }),
        func: async ({ text }) => {
          const sentiment = await this.analyzeSentiment(text);
          return `Sentiment analysis: ${sentiment.overall} (${sentiment.confidence}% confidence)`;
        },
      })
    );
  }

  protected async handleMessage(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    const content = message.content.toLowerCase();

    if (this.isNewsRequest(content)) {
      return await this.handleNewsRequest(message, context);
    } else if (this.isContentRequest(content)) {
      return await this.handleContentRequest(message, context);
    } else if (this.isTrendingRequest(content)) {
      return await this.handleTrendingRequest(message, context);
    }

    // Process with LLM for complex social queries
    const response = await this.processWithLLM(message.content, context);

    return {
      message: response,
      metadata: { handledBy: 'social-agent' }
    };
  }

  protected async shouldHandleMessage(message: DecodedMessage, context: AgentContext): Promise<boolean> {
    const content = message.content.toLowerCase();
    const socialKeywords = [
      'news', 'trending', 'content', 'social', 'feed', 'recommend', 
      'crypto news', 'updates', 'sentiment', 'community', 'share'
    ];
    
    return socialKeywords.some(keyword => content.includes(keyword));
  }

  protected async suggestNextAgent(message: DecodedMessage, context: AgentContext): Promise<string> {
    const content = message.content.toLowerCase();
    
    if (content.includes('trade') || content.includes('defi')) return 'trading';
    if (content.includes('game') || content.includes('play')) return 'gaming';
    if (content.includes('event') || content.includes('payment')) return 'utility';
    if (content.includes('app') || content.includes('tool')) return 'miniapp';
    
    return 'master';
  }

  private initializeContentSources(): void {
    const sources: ContentSource[] = [
      {
        name: 'CoinDesk',
        type: 'rss',
        url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
        categories: ['bitcoin', 'ethereum', 'defi', 'nft'],
        isActive: true,
      },
      {
        name: 'CoinTelegraph',
        type: 'rss',
        url: 'https://cointelegraph.com/rss',
        categories: ['altcoins', 'blockchain', 'regulation'],
        isActive: true,
      },
      {
        name: 'The Block',
        type: 'api',
        url: 'https://api.theblock.co/v1/news',
        categories: ['institutional', 'funding', 'technology'],
        isActive: true,
      },
    ];

    sources.forEach(source => this.contentSources.set(source.name, source));
  }

  private async getCryptoNews(category?: string, limit: number = 5): Promise<CuratedContent[]> {
    // In production, this would fetch from real news APIs
    const mockNews: CuratedContent[] = [
      {
        id: uuidv4(),
        title: 'Bitcoin Reaches New All-Time High',
        content: 'Bitcoin surpasses $100,000 as institutional adoption continues...',
        source: 'CoinDesk',
        category: 'bitcoin',
        relevanceScore: 0.95,
        timestamp: new Date(),
      },
      {
        id: uuidv4(),
        title: 'Base Network Surpasses 1 Million Daily Users',
        content: 'Coinbase Layer 2 solution shows strong growth metrics...',
        source: 'The Block',
        category: 'layer2',
        relevanceScore: 0.88,
        timestamp: new Date(),
      },
      {
        id: uuidv4(),
        title: 'DeFi Total Value Locked Reaches $200B',
        content: 'Decentralized finance protocols see massive growth...',
        source: 'CoinTelegraph',
        category: 'defi',
        relevanceScore: 0.82,
        timestamp: new Date(),
      },
    ];

    return category 
      ? mockNews.filter(news => news.category === category).slice(0, limit)
      : mockNews.slice(0, limit);
  }

  private async getTrendingTopics(): Promise<string[]> {
    // In production, this would analyze social media and news trends
    return [
      'Base Network Growth',
      'Bitcoin ETF',
      'DeFi Yield Farming',
      'NFT Gaming',
      'Layer 2 Scaling',
      'Cross-chain Bridges',
      'Memecoin Season',
    ];
  }

  private async setUserPreferences(
    userAddress: string, 
    interests: string[], 
    frequency: 'high' | 'medium' | 'low'
  ): Promise<void> {
    const preferences: UserPreferences = {
      interests,
      contentTypes: ['news', 'analysis', 'price_updates'],
      frequency,
      timeZone: 'UTC',
      language: 'en',
      notifications: {
        priceAlerts: true,
        gameInvites: false,
        eventReminders: false,
        contentUpdates: true,
        systemUpdates: false,
      },
    };

    this.userPreferences.set(userAddress, preferences);
  }

  private async getPersonalizedFeed(userAddress: string, limit: number): Promise<CuratedContent[]> {
    const preferences = this.userPreferences.get(userAddress);
    const allContent = await this.getCryptoNews();

    if (!preferences) {
      return allContent.slice(0, limit);
    }

    // Filter and score content based on user interests
    const scoredContent = allContent.map(content => ({
      ...content,
      relevanceScore: this.calculateRelevanceScore(content, preferences),
    }));

    return scoredContent
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  private calculateRelevanceScore(content: CuratedContent, preferences: UserPreferences): number {
    let score = content.relevanceScore;

    // Boost score for matching interests
    if (preferences.interests.some(interest => 
      content.title.toLowerCase().includes(interest.toLowerCase()) ||
      content.content.toLowerCase().includes(interest.toLowerCase())
    )) {
      score += 0.2;
    }

    // Boost score for matching categories
    if (preferences.interests.includes(content.category)) {
      score += 0.15;
    }

    return Math.min(score, 1.0);
  }

  private async recommendContent(conversationId: string, topic?: string): Promise<CuratedContent[]> {
    // In production, would analyze conversation history and participant preferences
    const allContent = await this.getCryptoNews();
    
    if (topic) {
      return allContent.filter(content => 
        content.title.toLowerCase().includes(topic.toLowerCase()) ||
        content.category === topic.toLowerCase()
      );
    }

    return allContent.slice(0, 3);
  }

  private async analyzeSentiment(text: string): Promise<{ overall: string; confidence: number }> {
    // In production, would use real sentiment analysis API
    const positiveWords = ['good', 'great', 'excellent', 'bullish', 'pump', 'moon'];
    const negativeWords = ['bad', 'terrible', 'bearish', 'dump', 'crash', 'scam'];
    
    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;

    words.forEach(word => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });

    let overall = 'neutral';
    let confidence = 50;

    if (positiveCount > negativeCount) {
      overall = 'positive';
      confidence = Math.min(50 + (positiveCount * 10), 95);
    } else if (negativeCount > positiveCount) {
      overall = 'negative';
      confidence = Math.min(50 + (negativeCount * 10), 95);
    }

    return { overall, confidence };
  }

  private isNewsRequest(content: string): boolean {
    return ['news', 'updates', 'latest', 'headlines'].some(word => content.includes(word));
  }

  private isContentRequest(content: string): boolean {
    return ['content', 'feed', 'recommend', 'suggest'].some(word => content.includes(word));
  }

  private isTrendingRequest(content: string): boolean {
    return ['trending', 'popular', 'hot', 'viral'].some(word => content.includes(word));
  }

  private async handleNewsRequest(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    const news = await this.getCryptoNews();
    const newsText = news.map(n => `📰 **${n.title}**\n${n.content.substring(0, 100)}...`).join('\n\n');
    
    return {
      message: `🔥 **Latest Crypto News:**\n\n${newsText}`,
      metadata: { handledBy: 'social-news' }
    };
  }

  private async handleContentRequest(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    return {
      message: "I can curate personalized content for you! Tell me your interests or let me know what type of content you'd like to see.",
      metadata: { handledBy: 'social-content' }
    };
  }

  private async handleTrendingRequest(message: DecodedMessage, context: AgentContext): Promise<AgentResponse> {
    const trends = await this.getTrendingTopics();
    const trendText = trends.map((trend, i) => `${i + 1}. ${trend}`).join('\n');
    
    return {
      message: `📈 **Trending Topics in Crypto:**\n\n${trendText}`,
      metadata: { handledBy: 'social-trending' }
    };
  }

  protected getSystemPrompt(): string {
    return `You are a Social Agent specialized in content curation and community engagement.

Your capabilities include:
- Curating relevant crypto and DeFi news
- Tracking trending topics and sentiment
- Personalizing content based on user preferences
- Analyzing social sentiment and community engagement
- Recommending content for groups and conversations

You help users:
1. Stay updated with latest crypto news and trends
2. Discover relevant content based on their interests
3. Understand market sentiment and community discussions
4. Share interesting content with their groups
5. Set up personalized content feeds and notifications

Keep content fresh, relevant, and engaging. Focus on quality over quantity and always verify information from reliable sources.

Current context: Providing social content and community engagement within XMTP conversations.`;
  }
}

export default SocialAgent; 
import { Inject, Injectable } from '@nestjs/common';
import { RedisPrefixEnum } from './enum/redis-prefix-enum';
import { RedisRepository } from './redis.repository';
import type Redis from 'ioredis';

export const oneDayInSeconds = 60 * 60 * 24;
export const tenMinutesInSeconds = 60 * 10;
export const halfHourInSeconds = 60 * 30;
export const minutesInSeconds = 60;
export const fiveminutesInSeconds = 60 * 5;


@Injectable()
export class RedisService {
  private readonly client: Redis;
  constructor(
    @Inject(RedisRepository) private readonly redisRepository: RedisRepository,
  ) { }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  /**
   * Common for all
   */

  async get(prefix: string, key: string): Promise<any> {
    const data = await this.redisRepository.get(key, prefix);
    return data ? JSON.parse(data) : null;
  }

  async set(prefix: string, key: string, value: object | any[]): Promise<void> {
    await this.redisRepository.set(prefix, key, JSON.stringify(value));
  }

  async delete(prefix: string, key: string): Promise<void> {
    await this.redisRepository.delete(prefix, key);
  }

  async setWithExpiry(
    prefix: string,
    key: string,
    value: object | any[],
    expiry: number = tenMinutesInSeconds,
  ): Promise<void> {
    await this.redisRepository.setWithExpiry(
      prefix,
      key,
      JSON.stringify(value),
      expiry,
    );
  }

  /**
   * User request Info
   */
  async saveUserDataByToken(
    token,
    userData,
    expireTimeInSeconds: number = tenMinutesInSeconds,
  ) {
    await this.redisRepository.setWithExpiry(
      RedisPrefixEnum.REQUEST_USER_DATA,
      token,
      JSON.stringify(userData),
      expireTimeInSeconds,
    );
  }
  /**
   * User request Info
   */
  async deleteUserDataByToken(token): Promise<any> {
    await this.redisRepository.delete(RedisPrefixEnum.REQUEST_USER_DATA, token);
  }
  /**
   * User request Info
   */
  async getUserDataByToken(token): Promise<any> {
    const userData = await this.redisRepository.get(
      RedisPrefixEnum.REQUEST_USER_DATA,
      token,
    );
    return userData ? JSON.parse(userData) : null;
  }
  /**
   * Agency Data
   */
  async saveAgencyInfo(url: string, agency) {
    await this.redisRepository.setWithExpiry(
      RedisPrefixEnum.AGENCY,
      url,
      JSON.stringify(agency),
      tenMinutesInSeconds,
    );
  }
  /**
   * Agency Data
   */
  async deleteAgencyInfo(url): Promise<any> {
    await this.redisRepository.delete(RedisPrefixEnum.AGENCY, url);
  }
  /**
   * Agency Data
   */
  async getAgencyInfo(url: string) {
    const agency = await this.redisRepository.get(RedisPrefixEnum.AGENCY, url);
    return agency ? JSON.parse(agency) : null;
  }
  /**
   * Campaign Data
   */
  async saveCampaignDetails(url: string, agency) {
    await this.redisRepository.setWithExpiry(
      RedisPrefixEnum.CAMPAIGN_DETAILS,
      url,
      JSON.stringify(agency),
      tenMinutesInSeconds,
    );
  }
  /**
   * Campaign Data
   */
  async getCampaignDetails(url: string) {
    const campaign = await this.redisRepository.get(
      RedisPrefixEnum.CAMPAIGN_DETAILS,
      url,
    );
    return campaign ? JSON.parse(campaign) : null;
  }
  /**
   * Campaign Data
   */
  async deleteCampaignDetails(url: string) {
    await this.redisRepository.delete(RedisPrefixEnum.CAMPAIGN_DETAILS, url);
  }
  /**
   * Campaign Votes
   */
  async saveCampaignVotes(votes_key: string, votes_data: object) {
    await this.redisRepository.setWithExpiry(
      RedisPrefixEnum.CAMPAIGN_VOTES,
      votes_key,
      JSON.stringify(votes_data),
      tenMinutesInSeconds,
    );
  }

  /**
   * Campaign Votes
   */
  async getCampaignVotes(votes_key: string) {
    const campaign = await this.redisRepository.get(
      RedisPrefixEnum.CAMPAIGN_VOTES,
      votes_key,
    );
    return campaign ? JSON.parse(campaign) : null;
  }
  /**
   * Campaign Votes
   */
  async deleteCampaignVotes(votes_key: string) {
    await this.redisRepository.delete(
      RedisPrefixEnum.CAMPAIGN_VOTES,
      votes_key,
    );
  }

  /**
   * Votable content
   */
  async saveVotableContent(votes_key: string, votes_data: object) {
    await this.redisRepository.setWithExpiry(
      RedisPrefixEnum.VOTABLE_CONTENT,
      votes_key,
      JSON.stringify(votes_data),
      tenMinutesInSeconds,
    );
  }

  /**
   *  Votable content
   */
  async getVotableContent(votes_key: string) {
    const campaign = await this.redisRepository.get(
      RedisPrefixEnum.VOTABLE_CONTENT,
      votes_key,
    );
    return campaign ? JSON.parse(campaign) : null;
  }

  /**
   *  Votable content
   */
  async deleteVotableContent(votes_key: string) {
    await this.redisRepository.delete(
      RedisPrefixEnum.VOTABLE_CONTENT,
      votes_key,
    );
  }

  /* what's app integration */
  async storeWhatsAppIntegrationState(state: string, user_id: bigint) {
    await this.redisRepository.setWithExpiry(
      RedisPrefixEnum.WHATS_APP_INTEGRATION,
      'state_' + user_id,
      state,
      fiveminutesInSeconds,
    );
  }
  async getWhatsAppIntegrationState(user_id: bigint) {
    const state = await this.redisRepository.get(RedisPrefixEnum.WHATS_APP_INTEGRATION, 'state_' + user_id);
    return state ?? null;
  }
}

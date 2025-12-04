import { Injectable } from '@nestjs/common'
import { PrismaService } from 'nestjs-prisma'
import { PinoLogger } from 'nestjs-pino'
import { google, iam_v1 } from 'googleapis'
import { Buffer } from 'buffer'
import { SsoProviderService } from '../auth/service/ssoprovider.service'
import { GoogleOauthFetcher } from '../auth/sso/google.oauth.fetcher'
import {
  IntegrationType,
  IntegrationStatus,
  ProviderType,
  FileType,
  ContactImportQueueStatus,
  type Prisma,
  YesNo,
  RequestType,
  RequestStatus,
  ContactStatus,
  ProductType,
  type Integration,
  NotificationType,
  Contact,
  GoogleContactLogStatus
} from '@prisma/client'

import { SelectSheetDto } from './dto/select-sheet.dto'
import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException
} from '@nestjs/common'
import { GrantType } from '@/common/enums/grand.type'
import { GoogleSheetQueryDto } from './dto/index.dto'
import { extractSpreadsheetId } from '@/utils/utils'
import type { LoginUser } from '../auth/dto/login-user.dto'
import type { GoogleSheetMetadataResponseDto } from './dto/google-sheet-metadata.dto'
import { BasePaginationDto } from '@/common/dto/base-pagination.dto'
import { MetaOAuthTokenService } from '../whatsapp/service/meta.oauth.token.service'
import { validateAndFormatPhoneNumber } from '@/utils/phone-numbers/phone-utils'

import { TriggerEventManager } from '../trigger/services/trigger-event-manager/trigger-event-manager.service'
import { EventKeys } from 'src/types/triggers'
import { getContactDisplayName } from '@/utils/contact'
import { TRIGGER_EVENT_CONTACT_ACTIONS } from '../trigger/constants/trigger.constant'
import { NotificationService } from '../notifications/notifications.service'
import { NotificationSourceType } from '../contacts/dto/index.dto'
import { parsePhoneNumber } from 'libphonenumber-js/max'
import { BasicUser } from '../user/dto/user.dto'
@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleOauthFetcher: GoogleOauthFetcher,
    private readonly ssoProviderService: SsoProviderService,
    private readonly logger: PinoLogger,
    private readonly metaOAuthTokenService: MetaOAuthTokenService,
    private readonly triggerEventManager: TriggerEventManager,
    private readonly notificationService: NotificationService
  ) {
    this.logger.setContext(IntegrationsService.name)
  }

  /**
   * Reusable function to get OAuth authorization URL for Google integrations.
   * Supports dynamic redirect URI and encodes userId in state for callback verification.
   * @param userId - The ID of the user initiating the connection.
   * @param integrationType - The type of integration (e.g., GOOGLE_SHEETS).
   * @param redirectUri - Optional dynamic redirect URI (falls back to SSO provider's redirect).
   * @returns The authorization URL.
   */
  async getGoogleAuthUrl(
    userId: bigint,
    integrationType: IntegrationType = IntegrationType.GOOGLE_SHEETS
  ): Promise<string> {
    // Decide redirect URL depending on integration type
    const redirectUrl =
      integrationType === IntegrationType.GOOGLE_CONTACT
        ? '/integrations/google-contacts/callback'
        : '/integrations/google-sheets/callback'

    // Find the correct SSO provider record
    const ssoProvider =
      await this.ssoProviderService.findSsoProviderByProviderAndRedirectUrl(
        ProviderType.GOOGLE,
        redirectUrl
      )

    if (!ssoProvider) {
      throw new Error('SSO provider not found')
    }

    // Choose scopes depending on integration type, always include userinfo.email
    let scopes = 'https://www.googleapis.com/auth/userinfo.email'
    if (integrationType === IntegrationType.GOOGLE_SHEETS) {
      scopes +=
        ' https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly'
    } else if (integrationType === IntegrationType.GOOGLE_CONTACT) {
      scopes += ' https://www.googleapis.com/auth/contacts.readonly'
    }
    // Encode user + integration type in state
    const state = Buffer.from(
      `${userId.toString()}:${integrationType}`
    ).toString('base64')
    const effectiveRedirectUri = ssoProvider.redirectUrl

    const params = new URLSearchParams({
      client_id: ssoProvider.clientId,
      redirect_uri: effectiveRedirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      state
    })

    const googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
    const url = `${googleAuthUrl}?${params.toString()}`
    return url
  }

  /**
   * Reusable function to handle Google OAuth callback.
   * Verifies state, exchanges code for tokens, creates/updates integration, and returns redirect URL.
   * @param code - The authorization code from Google.
   * @param state - The state parameter containing encoded userId and type.
   * @param clientBaseUrl - The base URL for client-side redirect.
   * @returns An object with the client redirect URL.
   */
  async handleGoogleCallback(
    code: string,
    state: string,
    clientBaseUrl: string
  ): Promise<{ url: string }> {
    if (!state) {
      throw new Error('State parameter is missing')
    }
    const decodedState = Buffer.from(state, 'base64').toString()
    const [userIdStr, integrationType] = decodedState.split(':')

    if (!userIdStr || !integrationType) {
      throw new Error('Invalid state parameter')
    }
    const userId = BigInt(userIdStr)

    // Ensure integrationType is valid
    if (
      !Object.values(IntegrationType).includes(
        integrationType as IntegrationType
      )
    ) {
      throw new Error(`Invalid integration type: ${integrationType}`)
    }

    // Choose redirect URL based on integrationType
    const redirectUrl =
      integrationType === IntegrationType.GOOGLE_SHEETS
        ? '/integrations/google-sheets/callback'
        : '/integrations/google-contacts/callback'

    // Find SSO provider config
    const ssoProvider =
      await this.ssoProviderService.findSsoProviderByProviderAndRedirectUrl(
        ProviderType.GOOGLE,
        redirectUrl
      )

    if (!ssoProvider) {
      throw new Error('SSO provider not found')
    }

    const tokenResponse = await this.googleOauthFetcher.fetchTokenWithGrant(
      code,
      ssoProvider,
      GrantType.AUTHORIZATION_CODE
    )

    if (!tokenResponse || !tokenResponse.accessToken) {
      throw new Error('Failed to retrieve access token from Google')
    }

    // Decode idToken to get email
    // Fetch email using accessToken
    let accountEmail: string | undefined
    try {
      const userInfoResponse = await this.googleOauthFetcher.fetchWithAuth(
        'https://www.googleapis.com/userinfo/v2/me',
        tokenResponse.accessToken
      )
      const userInfo = await userInfoResponse.json()
      accountEmail = userInfo.email
    } catch (error) {
      console.error('Failed to fetch user email:', error)
      // Continue without email to avoid breaking the flow
    }

    if (!accountEmail) {
      throw new Error('Failed to retrieve account email from Google')
    }

    const expiresAt = new Date(Date.now() + tokenResponse.expiresIn * 1000)

    // Check for existing integration by accountEmail and type
    let integration = await this.prisma.integration.findFirst({
      where: {
        userId,
        type: integrationType as IntegrationType,
        accountEmail
      }
    })

    if (integration) {
      // Update existing integration
      integration = await this.prisma.integration.update({
        where: { id: integration.id },
        data: {
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken || integration.refreshToken,
          expiresAt,
          updatedAt: new Date()
        }
      })
    } else {
      // Create new integration
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { agency: { select: { id: true } } }
      })

      if (!user) {
        throw new NotFoundException('User not found')
      }

      integration = await this.prisma.integration.create({
        data: {
          userId,
          agencyId: user.agency.id,
          type: integrationType as IntegrationType,
          name: `${integrationType} Integration`,
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken,
          expiresAt,
          status: IntegrationStatus.ACTIVE,
          accountEmail
        }
      })
    }

    // Choose redirect path for frontend
    const redirectPath =
      integrationType === IntegrationType.GOOGLE_SHEETS
        ? 'google-sheets'
        : 'google-contacts'

    return {
      url: `${clientBaseUrl}/import-contacts/${redirectPath}?integrationId=${integration.id}&type=${integration.type}&email=${accountEmail}`
    }
  }

  /**
   * Reusable function to get an authenticated Google OAuth client.
   * Checks access token validity and refreshes it using the refresh token if invalid or expired.
   * @param integration - The integration record containing tokens.
   * @returns The authenticated OAuth2 client.
   */
  async getGoogleClient(integration: any): Promise<any> {
    const ssoProvider =
      await this.ssoProviderService.findSsoProviderByProviderAndRedirectUrl(
        'GOOGLE',
        '/integrations/google-sheets/callback'
      )
    const oauth2Client = new google.auth.OAuth2(
      ssoProvider.clientId,
      ssoProvider.clientSecret,
      ssoProvider.redirectUrl
    )

    oauth2Client.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken,
      expiry_date: integration.expiresAt.getTime()
    })

    // Check if access token is expired or invalid
    const isTokenExpired = new Date() > integration.expiresAt
    let isTokenValid = !isTokenExpired

    if (!isTokenExpired) {
      // Test access token validity by making a lightweight API call (e.g., Drive files.list with minimal fields)
      try {
        const drive = google.drive({ version: 'v3', auth: oauth2Client })
        await drive.files.list({ pageSize: 1, fields: 'files(id)' })
        this.logger.info(
          `Access token is valid for integration ID ${integration.id}`
        )
      } catch (error) {
        this.logger.warn(
          `Access token invalid for integration ID ${integration.id}: ${error.message}`
        )
        isTokenValid = false
      }
    }

    // Refresh token if expired or invalid
    if (!isTokenValid) {
      if (!integration.refreshToken) {
        throw new UnauthorizedException(
          'No refresh token available for integration'
        )
      }

      try {
        const tokenResponse = await this.googleOauthFetcher.fetchTokenWithGrant(
          integration.refreshToken,
          ssoProvider,
          GrantType.REFRESH_TOKEN // Assuming GrantType is string enum
        )

        if (!tokenResponse || !tokenResponse.accessToken) {
          throw new UnauthorizedException('Failed to refresh access token')
        }

        const newExpiresAt = new Date(
          Date.now() + tokenResponse.expiresIn * 1000
        )
        await this.prisma.integration.update({
          where: { id: integration.id },
          data: {
            accessToken: tokenResponse.accessToken,
            expiresAt: newExpiresAt,
            updatedAt: new Date()
          }
        })

        oauth2Client.setCredentials({
          access_token: tokenResponse.accessToken,
          refresh_token: integration.refreshToken,
          expiry_date: newExpiresAt.getTime()
        })

        this.logger.info(
          `Access token refreshed for integration ID ${integration.id}`
        )
      } catch (error) {
        this.logger.error(
          `Failed to refresh access token for integration ID ${integration.id}: ${error.message}`
        )
        throw new UnauthorizedException(
          `Failed to refresh access token: ${error.message}`
        )
      }
    }

    return oauth2Client
  }

  /**
   * Fetches metadata for a Google Sheet by sheetId.
   * @param userId - The ID of the user.
   * @param sheetId - The ID of the Google Sheet.
   * @returns Metadata including spreadsheet ID, title, and sheet names.
   */
  async getGoogleSheetMetadata(
    userId: bigint,
    integrationId: bigint,
    sheetId: string
  ): Promise<GoogleSheetMetadataResponseDto> {
    const integration = await this.prisma.integration.findFirst({
      where: {
        id: integrationId,
        userId,
        type: IntegrationType.GOOGLE_SHEETS,
        status: IntegrationStatus.ACTIVE
      }
    })

    if (!integration) {
      this.logger.error(
        `No active Google Sheets integration found for user ${userId}`
      )
      throw new NotFoundException('No active Google Sheets integration found')
    }

    const auth = await this.getGoogleClient(integration)
    const sheets = google.sheets({ version: 'v4', auth })

    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        fields: 'spreadsheetId,properties.title,sheets.properties.title'
      })

      const spreadsheet = response.data
      const sheetNames =
        spreadsheet.sheets?.map((sheet: any) => sheet.properties.title) || []

      return {
        spreadsheetId: spreadsheet.spreadsheetId!,
        title: spreadsheet.properties?.title || `Sheet_${sheetId.slice(0, 8)}`,
        sheetNames
      }
    } catch (error) {
      this.logger.error(
        `Failed to fetch metadata for sheet ${sheetId}: ${error.message}`
      )
      throw new BadRequestException(
        `Failed to fetch sheet metadata: ${error.message}`
      )
    }
  }

  /**
   * Lists all Google Sheets the user has access to using the Drive API with pagination and search.
   * Maps sheet IDs and checks ContactImportQueue for matching sheetIds in fieldMapping string.
   * @param userId - The ID of the user.
   * @param dto - DTO containing page, limit, and search parameters.
   * @returns Paginated list of sheets with id, name, and import status.
   */
  async listUserSheets(
    userId: bigint,
    integrationId: bigint,
    dto: GoogleSheetQueryDto
  ) {
    const { page = '1', limit = '10', search } = dto
    const parsedPage = Math.max(1, Number(page))
    const parsedLimit = Math.min(Math.max(1, Number(limit)), 100)

    const integration = await this.prisma.integration.findFirst({
      where: {
        id: integrationId,
        userId,
        type: IntegrationType.GOOGLE_SHEETS,
        status: IntegrationStatus.ACTIVE
      }
    })

    if (!integration) {
      throw new NotFoundException('No active Google Sheets integration found')
    }

    const auth = await this.getGoogleClient(integration)
    const drive = google.drive({ version: 'v3', auth })

    let query = "mimeType='application/vnd.google-apps.spreadsheet'"
    if (search?.trim()) {
      query += ` and name contains '${search.trim().replace(/'/g, "\\'")}'`
    }

    try {
      // Fetch paginated sheets
      const sheetsResponse = await drive.files.list({
        q: query,
        fields: 'nextPageToken, files(id, name, modifiedTime)',
        pageSize: parsedLimit,
        pageToken:
          parsedPage > 1
            ? (
              await drive.files.list({
                q: query,
                pageSize: parsedLimit,
                fields: 'nextPageToken'
              })
            ).data.nextPageToken
            : undefined
      })

      // Get total count for pagination
      const totalResponse = await drive.files.list({
        q: query,
        fields: 'files(id)'
      })

      const sheets = sheetsResponse.data.files || []
      const sheetIds = sheets.map((sheet) => sheet.id!).filter(Boolean)

      // Fetch ContactImportQueue entries for Google Sheets
      const contactImportQueues = await this.prisma.contactImportQueue.findMany(
        {
          where: {
            userId,
            fileType: FileType.GOOGLE_SHEET,
            status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] }
          },
          select: {
            id: true,
            fieldMapping: true,
            status: true,
            updatedAt: true
          }
        }
      )

      // Map sheets with import status
      const mappedSheets = sheets.map((sheet) => {
        let isAlreadyImported = false
        let importedAt: Date | undefined
        let importedItemId: bigint | undefined
        let importedStatus: ContactImportQueueStatus | undefined

        const matchingQueue = contactImportQueues.find((queue) => {
          try {
            const fieldMapping = JSON.parse(queue.fieldMapping as string) as {
              configs?: { googleSheetsConfig?: { sheetId?: string } }
            }
            return (
              fieldMapping?.configs?.googleSheetsConfig?.sheetId === sheet.id
            )
          } catch (error) {
            this.logger.error(
              `Failed to parse fieldMapping for ContactImportQueue ID ${queue.id}: ${error.message}`
            )
            return false
          }
        })

        if (matchingQueue) {
          isAlreadyImported = true
          importedAt = matchingQueue.updatedAt
          importedItemId = matchingQueue.id
          importedStatus = matchingQueue.status
        }

        return {
          id: sheet.id!,
          name: sheet.name!,
          modifiedTime: sheet.modifiedTime,
          isAlreadyImported,
          importedAt,
          importedItemId,
          importedStatus
        }
      })

      const total = totalResponse.data.files?.length || 0

      return {
        sheets: mappedSheets,
        total,
        filteredTotal: total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
        message:
          mappedSheets.length === 0
            ? 'No Google Sheets found for the given criteria.'
            : undefined
      }
    } catch (error) {
      this.logger.error(`Failed to fetch Google Sheets list: ${error.message}`)
      return {
        sheets: [],
        total: 0,
        filteredTotal: 0,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: 0,
        message: 'An unexpected error occurred while fetching Google Sheets.'
      }
    }
  }

  /**
   * Fetches CSV content for a Google Sheet.
   * Validates the sheet ID or URL and ensures the user has access.
   * @param userId - The ID of the user.
   * @param input - Either a Google Sheet URL or spreadsheet ID.
   * @returns The CSV content as a string.
   */
  async generateGoogleSheetCsvContent(
    userId: bigint,
    input: string,
    integrationId: bigint
  ): Promise<{ csvContent: string }> {
    let spreadsheetId: string

    // Validate input: Check if it's a URL or direct spreadsheet ID
    if (input.includes('docs.google.com/spreadsheets')) {
      const sheetId = extractSpreadsheetId(input)
      if (!sheetId) {
        throw new BadRequestException('Invalid Google Sheet URL')
      }
      spreadsheetId = sheetId
    } else {
      // Assume input is a spreadsheet ID
      spreadsheetId = input
    }

    // Validate that the user has access to the sheet
    const integration = await this.prisma.integration.findFirst({
      where: {
        id: integrationId,
        userId,
        type: IntegrationType.GOOGLE_SHEETS,
        status: IntegrationStatus.ACTIVE
      }
    })

    if (!integration) {
      throw new NotFoundException('No active Google Sheets integration found')
    }

    const auth = await this.getGoogleClient(integration)
    const sheets = google.sheets({ version: 'v4', auth })

    try {
      // Verify sheet exists and user has access
      await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'spreadsheetId,properties.title'
      })

      // Fetch CSV content using the Sheets API or export URL
      const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`
      const response = await this.googleOauthFetcher.fetchWithAuth(
        exportUrl,
        integration.accessToken
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${response.statusText}`)
      }

      const csvContent = await response.text()
      return { csvContent }
    } catch (error) {
      this.logger.error(
        `Failed to fetch CSV content for Google Sheet ${spreadsheetId}: ${error.message}`
      )
      throw new BadRequestException(
        `Failed to fetch CSV content: ${error.message}`
      )
    }
  }

  /**
   * Selects a specific sheet by updating the integration config.
   * @param userId - The ID of the user.
   * @param integrationId - The ID of the integration.
   * @param dto - DTO containing spreadsheetId.
   * @returns The updated integration.
   */
  async selectSheet(
    userId: bigint,
    integrationId: bigint,
    dto: SelectSheetDto
  ) {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId }
    })

    if (!integration || integration.userId !== userId) {
      throw new NotFoundException('Integration not found or access denied')
    }

    return this.prisma.integration.update({
      where: { id: integrationId },
      data: { config: { spreadsheetId: dto.spreadsheetId } }
    })
  }

  /**
   * Fetches all integrations for a user and agency, optionally filtered by type.
   * Refreshes access tokens if expired for each integration.
   * @param userId - The ID of the user.
   * @param agencyId - The ID of the agency.
   * @param type - Optional integration type to filter (e.g., GOOGLE_SHEETS).
   * @returns Array of integration objects.
   */
  async getUserIntegrations(
    userId: bigint,
    agencyId: bigint,
    type?: IntegrationType
  ): Promise<any[]> {
    const whereClause: Prisma.IntegrationWhereInput = {
      userId,
      agencyId,
      status: IntegrationStatus.ACTIVE
    }

    if (type && Object.values(IntegrationType).includes(type)) {
      whereClause.type = type
    }

    const integrations = await this.prisma.integration.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    })

    // Refresh tokens for expired integrations
    const updatedIntegrations = await Promise.all(
      integrations.map(async (integration) => {
        const isTokenExpired = new Date() > integration.expiresAt
        if (isTokenExpired && integration.refreshToken) {
          try {
            const ssoProvider =
              await this.ssoProviderService.findSsoProviderByProviderAndRedirectUrl(
                ProviderType.GOOGLE,
                '/integrations/google-sheets/callback'
              )
            if (!ssoProvider) {
              this.logger.warn(
                `SSO provider not found for integration ID ${integration.id}`
              )
              return integration
            }

            const tokenResponse =
              await this.googleOauthFetcher.fetchTokenWithGrant(
                integration.refreshToken,
                ssoProvider,
                GrantType.REFRESH_TOKEN
              )

            if (!tokenResponse || !tokenResponse.accessToken) {
              this.logger.warn(
                `Failed to refresh access token for integration ID ${integration.id}`
              )
              return integration
            }

            const newExpiresAt = new Date(
              Date.now() + tokenResponse.expiresIn * 1000
            )
            const updatedIntegration = await this.prisma.integration.update({
              where: { id: integration.id },
              data: {
                accessToken: tokenResponse.accessToken,
                expiresAt: newExpiresAt,
                updatedAt: new Date()
              }
            })

            this.logger.info(
              `Access token refreshed for integration ID ${integration.id}`
            )
            return updatedIntegration
          } catch (error) {
            this.logger.error(
              `Failed to refresh access token for integration ID ${integration.id}: ${error.message}`
            )
            return integration
          }
        }
        return integration
      })
    )

    return updatedIntegrations
  }

  /**
   * Fetches an integration by userId, agencyId, and type, refreshing the access token if expired.
   * @param userId - The ID of the user.
   * @param agencyId - The ID of the agency.
   * @param type - The type of integration (e.g., GOOGLE_SHEETS).
   * @returns The integration object or null if not found.
   */
  async getUserIntegration(
    user: LoginUser,
    integrationId: bigint,
    type: IntegrationType
  ): Promise<any> {
    const integration = await this.prisma.integration.findFirst({
      where: {
        id: integrationId,
        userId: user.parentUserId || user.id,
        agencyId: user.agencyId,
        type,
        status: IntegrationStatus.ACTIVE
      }
    })

    if (!integration) {
      return null
    }

    // Check if access token is expired or invalid
    const isTokenExpired = new Date() > integration.expiresAt
    if (isTokenExpired && integration.refreshToken) {
      try {
        const redirectUrl = this.getRedirectUrl(type)

        const ssoProvider =
          await this.ssoProviderService.findSsoProviderByProviderAndRedirectUrl(
            ProviderType.GOOGLE,
            redirectUrl
          )

        if (!ssoProvider) {
          throw new Error('SSO provider not found')
        }

        const tokenResponse = await this.googleOauthFetcher.fetchTokenWithGrant(
          integration.refreshToken,
          ssoProvider,
          GrantType.REFRESH_TOKEN
        )

        if (!tokenResponse || !tokenResponse.accessToken) {
          throw new UnauthorizedException('Failed to refresh access token')
        }

        const newExpiresAt = new Date(
          Date.now() + tokenResponse.expiresIn * 1000
        )
        const updatedIntegration = await this.prisma.integration.update({
          where: { id: integration.id },
          data: {
            accessToken: tokenResponse.accessToken,
            expiresAt: newExpiresAt,
            updatedAt: new Date()
          }
        })

        this.logger.info(
          `Access token refreshed for integration ID ${integration.id}`
        )
        return updatedIntegration
      } catch (error) {
        this.logger.error(
          `Failed to refresh access token for integration ID ${integration.id}: ${error.message}`
        )
        throw new UnauthorizedException(
          `Failed to refresh access token: ${error.message}`
        )
      }
    }

    return integration
  }

  /**
   * Disconnects an integration by userId and type.
   * Deletes the integration if it exists and is owned by the user.
   * @param userId - The ID of the user.
   * @param type - The type of integration to disconnect (e.g., GOOGLE_SHEETS).
   * @returns Success message.
   */
  async disconnectService(
    userId: bigint,
    integrationId: bigint,
    type: IntegrationType
  ): Promise<{ message: string }> {
    if (!Object.values(IntegrationType).includes(type)) {
      throw new BadRequestException(`Invalid integration type: ${type}`)
    }

    const integration = await this.prisma.integration.findFirst({
      where: {
        id: integrationId,
        userId,
        type,
        status: IntegrationStatus.ACTIVE
      }
    })

    if (!integration) {
      throw new NotFoundException(
        `No active ${type} integration found for user`
      )
    }

    await this.prisma.integration.delete({
      where: { id: integration.id }
    })

    this.logger.info(`Integration ${type} disconnected for user ID ${userId}`)
    return { message: `Successfully disconnected ${type} integration` }
  }

  /**
   * Fetches the connection status for user integrations and email verification.
   * @param user - The authenticated user object containing id and isMailVerified.
   * @returns An object with integration connection statuses.
   */
  async getUserConnectionStatus(user: LoginUser): Promise<{
    [IntegrationType.GOOGLE_SHEETS]: { isConnected: boolean, connectedAccounts?: Integration[] }
    [IntegrationType.GOOGLE_CONTACT]: { isConnected: boolean, connectedAccounts?: Integration[] }
    EMAIL_VERIFICATION: { isConnected: boolean, connectedAccounts?: Integration[] }
    [IntegrationType.META_BUSINESS]: { isConnected: boolean, connectedAccounts?: Integration[] }
    [IntegrationType.TWILIO]: { isConnected: boolean, connectedAccounts?: Integration[] }
    [IntegrationType.ZAPIER]: { isConnected: boolean, connectedAccounts?: Integration[] }
    [IntegrationType.SHOPIFY]: { isConnected: boolean, connectedAccounts?: Integration[] }
  }> {
    this.logger.info(
      `Fetching integration connection status for user ID ${user.id}`
    )

    // Fetch all active integrations for the user
    const integrations = await this.prisma.integration.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        type: true,
        name: true,
        accountEmail: true,
        createdAt: true,
        updatedAt: true
      }
    })

    // Map integration types to their connection status
    const integrationStatus = {
      GOOGLE_SHEETS: false,
      GOOGLE_CONTACT: false,
      META_BUSINESS: false,
      TWILIO: false,
      ZAPIER: false,
      SHOPIFY: false
    }

    integrations.forEach((integration) => {
      if (integration.type in integrationStatus) {
        integrationStatus[integration.type] = true
      }
    })

    const metaData =
      await this.metaOAuthTokenService.findOauthTokenByUserAndProductType(
        user.id,
        ProductType.WHATS_APP
      )
    return {
      GOOGLE_SHEETS: {
        isConnected: integrationStatus.GOOGLE_SHEETS,
        connectedAccounts: integrations
          .filter((intg) => intg.type === IntegrationType.GOOGLE_SHEETS) as Integration[]
      },
      GOOGLE_CONTACT: {
        isConnected: integrationStatus.GOOGLE_CONTACT,
        connectedAccounts: integrations
          .filter((intg) => intg.type === IntegrationType.GOOGLE_CONTACT) as Integration[]
      },
      EMAIL_VERIFICATION: {
        isConnected: user.isMailVerified === YesNo.YES,
        connectedAccounts: []
      },
      META_BUSINESS: {
        isConnected:
          metaData && metaData.profileData
            ? true
            : integrationStatus.META_BUSINESS
      },
      TWILIO: { isConnected: integrationStatus.TWILIO },
      ZAPIER: { isConnected: integrationStatus.ZAPIER },
      SHOPIFY: { isConnected: integrationStatus.SHOPIFY }
    }
  }

  async fetchGoogleContacts(
    accessToken: string,
    query: BasePaginationDto
  ): Promise<{
    contacts: any[]
    total: number
    perPage: number
    currentPage: number
    totalPages: number
  }> {
    try {
      const { page = 1, perPage = 10, needPagination } = query

      console.log('query', query)

      let url =
        'https://people.googleapis.com/v1/people/me/connections' +
        '?personFields=names,emailAddresses,phoneNumbers'

      // If pagination enabled, apply pageSize
      if (needPagination) {
        url += `&pageSize=${perPage}`
      }

      // If page > 1, you need to walk through previous pages using pageToken
      let nextPageToken: string | undefined
      let currentPage = 1

      do {
        const response = await fetch(
          nextPageToken ? `${url}&pageToken=${nextPageToken}` : url,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        if (!response.ok) {
          throw new Error(
            `Google Contacts fetch failed: ${response.statusText}`
          )
        }

        const data = await response.json()
        const batch = data.connections || []
        nextPageToken = data.nextPageToken

        if (!needPagination) {
          // If pagination not required, return all contacts immediately
          return {
            contacts: batch,
            total: batch.length,
            perPage: batch.length,
            currentPage: 1,
            totalPages: 1
          }
        }

        if (currentPage === page) {
          return {
            contacts: batch,
            total: batch.length, // optionally, sum all pages for total count
            perPage,
            currentPage: page,
            totalPages: nextPageToken ? page + 1 : page
          }
        }

        currentPage++
      } while (nextPageToken)

      return {
        contacts: [],
        total: 0,
        perPage,
        currentPage: page,
        totalPages: currentPage - 1
      }
    } catch (error) {
      console.error('Failed to fetch Google contacts:', error)
      return {
        contacts: [],
        total: 0,
        perPage: query.perPage || 10,
        currentPage: query.page || 1,
        totalPages: 0
      }
    }
  }

  async queueGoogleContactsImport(user: LoginUser, integrationId: bigint) {
    const request = await this.prisma.userRequest.create({
      data: {
        userId: user.id,
        agencyId: user.agencyId,
        type: RequestType.IMPORT_GOOGLE_CONTACTS,
        status: RequestStatus.QUEUE,
        message: 'Queued Google Contacts import request',
        requestAt: new Date(),
        scheduleAt: new Date(),
        requestBody: JSON.stringify({ integrationId })
      }
    })

    console.log('contact import request==============', request)

    return {
      message: 'Google Contacts import request queued successfully.',
      requestId: request.id
    }
  }

  async importAllGoogleContacts() {
    const queuedRequests = await this.prisma.userRequest.findMany({
      where: {
        type: RequestType.IMPORT_GOOGLE_CONTACTS,
        status: RequestStatus.QUEUE
      },
      select: {
        id: true,
        userId: true,
        requestBody: true
      }
    })

    console.log(
      'import All GoogleContacts requests ============',
      queuedRequests
    )
    if (!queuedRequests.length) {
      return {
        message: 'No queued Google Contacts import requests found',
        importedCount: 0
      }
    }

    let user = null

    let totalImported = 0

    for (const request of queuedRequests) {

      const { integrationId } = JSON.parse(request?.requestBody as unknown as string)
      try {
        const user = await this.prisma.user.findFirst({
          where: {
            id: request.userId
          }
        })

        const loggedInUser: LoginUser = {
          ...user,
          parentUserId: user.id,
          access: null,
          refresh: null,
          packageId: null,
          permissions: null,
          roleName: null,
          roleId: null,
          agency: null,
          currentCredit: user.currentCredit.toNumber(),
          removedPermissionMask: BigInt(user.removedPermissionMask || 0),
          addedPermissionMask: BigInt(user.addedPermissionMask || 0),
          rolePermissionMask: BigInt(user.rolePermissionMask || 0) // 👈 convert string → bigint
        }

        const result = await this.importGoogleContacts(loggedInUser, integrationId)
        totalImported += result.importedCount

        // 6. Update the queued request as COMPLETED
        await this.prisma.userRequest.update({
          where: { id: request.id },
          data: {
            status: RequestStatus.PROCESSED,
            message: `Imported ${totalImported} contact(s) successfully`
          }
        })
      } catch (error) {
        console.error(
          `Error processing request===================== ${request.id}: ${error.message}`
        )
        await this.prisma.userRequest.update({
          where: { id: request.id },
          data: {
            status: RequestStatus.FAILED,
            message: error.message?.substring(0, 250) || 'Unknown error'
          }
        })
      }
    }
    return {
      message: `Processed ${queuedRequests.length} queued requests. Imported ${totalImported} contact(s) total.`,
      importedCount: totalImported
    }
  }

  async importGoogleContacts(user: LoginUser, integrationId: bigint) {
    // 1. Check if there is a queued request for this user
    const queuedRequest = await this.prisma.userRequest.findFirst({
      where: {
        userId: user.parentUserId ?? user.id,
        type: RequestType.IMPORT_GOOGLE_CONTACTS,
        status: RequestStatus.QUEUE
      }
    })
    console.log(
      'import single GoogleContacts requests ============',
      queuedRequest
    )
    if (!queuedRequest) {
      return {
        message: 'No queued Google Contacts import request found',
        importedCount: 0
      }
    }

    try {
      // 2. Fetch the Google Contacts integration for this user
      const integration = await this.getUserIntegration(
        user,
        integrationId,
        IntegrationType.GOOGLE_CONTACT
      )

      console.log('integration=========', integration)
      console.log(
        'integration.accountEmail================>',
        integration.accountEmail
      )

      if (!integration || !integration.accountEmail) {
        throw new NotFoundException(
          'Google Contacts integration not found or email missing'
        )
      }

      // 3. Get a valid OAuth client (refresh token if needed)
      const oauth2Client = await this.getGoogleClient(integration)

      // 4. Find or create GmailAccount
      const gmailEmail = integration.accountEmail

      if (!gmailEmail) {
        console.log('Integration accountEmail is missing')
        throw new Error('Integration accountEmail is missing')
      }

      let gmailAccount = await this.prisma.gmailAccount.findFirst({
        where: { email: gmailEmail }
      })

      if (!gmailAccount) {
        gmailAccount = await this.prisma.gmailAccount.create({
          data: {
            userId: user.parentUserId ?? user.id,
            agencyId: user.agencyId,
            email: gmailEmail,
            accessToken: oauth2Client.credentials.access_token,
            refreshToken: oauth2Client.credentials.refresh_token,
            expiresAt: oauth2Client.credentials.expiry_date
              ? new Date(oauth2Client.credentials.expiry_date)
              : null
          }
        })
      }

      console.log('gmailAccount==============', gmailAccount)

      // 5. Fetch contacts from Google People API
      const contacts = await this.googleOauthFetcher.fetchGoogleContacts(
        oauth2Client.credentials.access_token
      )

      const source = await this.getGoogleContactSource(user.agencyId)

      let importedCount = 0;
      let duplicate = 0;
      let totalContacts = contacts ? contacts.length : 0;
      let invalid = 0;
      let invalidReason = '';
      let parsedPhone=undefined;

      for (const contact of contacts) {

        const firstName = contact.names?.[0]?.givenName || ''
        const lastName = contact.names?.[0]?.familyName || ''
        // const displayName = contact.names?.[0]?.displayName || '';
        const phone = contact.phoneNumbers?.[0]?.canonicalForm || ''
        const email = contact.emailAddresses?.[0]?.value || ''

        if (!phone) {
          invalid++;
          await this.addGoogleContactLogs(user, parsedPhone, contact, queuedRequest.id,  GoogleContactLogStatus.INVALID, "Number not exists for this google contact");
          continue
        }
        /**
         * parsed phone to extract countryCode & country
         */
        parsedPhone = parsePhoneNumber(phone);


        // Skip if this contact already imported for this Gmail account
        // const existingGmailContact =
        //   await this.prisma.gmailImportedContact.findFirst({
        //     where: {
        //       gmailId: contact.resourceName,
        //       gmailAccountId: gmailAccount.id
        //     },
        //     include: { contact: true }
        //   })

        // if (existingGmailContact) {
        //   console.log(
        //     `Skipping already imported contact: ${contact.resourceName}`
        //   )
        //   continue //  prevent duplicates
        // }

        // Check if contact exists
        const existing = await this.existingContact(user, phone);
        let contactId: bigint

        if (existing) {
          const updatedContact = await this.updateContact(existing, firstName, lastName, email, contact);
          contactId = existing.id
          duplicate++;
          await this.addGoogleContactLogs(user, parsedPhone, contact, queuedRequest.id,  GoogleContactLogStatus.DUPLICATE, `Number already exists.For contact: ${existing.firstName} ${existing.lastName}`);
        } else {
          const newContact = await this.addNewContact(user, parsedPhone, contact, source.id);
          console.log('newContact==============', newContact)
          contactId = newContact.id;
          contact.id = newContact.id;
          /**
           * create contactAddTagTrigger if any event exists
           */
          await this.createContactAddTrigger(newContact);

          /**
           * add google contact log
           */
          await this.addGoogleContactLogs(user, parsedPhone, contact, queuedRequest.id,  GoogleContactLogStatus.CREATED, invalidReason);
        }

        await this.addGmailImportedContact(user, contactId, gmailAccount.id, contact.resourceName);

        importedCount = contactId ? importedCount++ : importedCount;
      }

      // Mark request as COMPLETED
      ///  Notify the user
      await this.sendNotification(user, 'Google Contacts import complete!', `Your Google Contacts import has been processed. A total of ${importedCount} contact(s) were imported.`,
        importedCount,
        NotificationSourceType.SUCCESS,
        '/contacts')
      
      let googleContactImportSummary = JSON.stringify({
        totalContacts,
        created: importedCount,
        duplicate,
        invalid
      });
      return {
        message: googleContactImportSummary,
        importedCount
      }
    } catch (error) {
      // Mark request as FAILED
      console.log('Error processing request:===================', error)
      await this.prisma.userRequest.update({
        where: { id: queuedRequest.id },
        data: {
          status: RequestStatus.FAILED,
          message: error.message?.substring(0, 250) || 'Unknown error'
        }
      })
      // Notify the user
       await this.sendNotification(user, 'Google Contacts import failed!', `Your Google Contacts import has failed. Please try again later.`,
        0, NotificationSourceType.ERROR,'/contact-queue-list')
      throw error
    }
  }

  /**
   * @check contact exists with phone number
   * @param user 
   * @param phone 
   */
  private async existingContact(user: LoginUser, phone:string){
    return await this.prisma.contact.findFirst({
          where: {
            userId: user.parentUserId ?? user.id,
            agencyId: user.agencyId,
            number: phone
          }
        })
  }

  private async updateContact(existing: Contact, firstName:string, lastName:string, email: string, contact:any){
     return await this.prisma.contact.update({
            where: { id: existing.id },
            data: {
              firstName: firstName || existing.firstName,
              lastName: lastName || existing.lastName,
              email: email || existing.email,
              googleContactId: contact.resourceName,
              updatedAt: new Date()
            }
      })
  }

  private async addNewContact(user:LoginUser, parsedPhone:any, contact:any, sourceId:bigint){
    return await this.prisma.contact.create({
            data: {
              userId: user.parentUserId ?? user.id,
              agencyId: user.agencyId,
              number: contact.phoneNumbers?.[0]?.canonicalForm || '',
              country: parsedPhone.country,
              countryCode: parsedPhone.countryCallingCode,
              createdBy: user.id,
              firstName: contact.names?.[0]?.givenName || '',
              lastName: contact.names?.[0]?.familyName || '',
              email: contact.phoneNumbers?.[0]?.canonicalForm || '',
              sourceId: sourceId,
              googleContactId: contact.resourceName,
              status: ContactStatus.ACTIVE
            }
      })
  }

  private async createContactAddTrigger(newContact: Contact){
    if(!newContact.id){
      return;
    }
    await this.triggerEventManager.createTriggerEventQueue({
            agencyId: newContact.agencyId,
            userId: newContact.userId,
            contactId: newContact.id,
            eventKey: EventKeys.CONTACT_ADDED,
            payload: {
              contact: {
                displayName: getContactDisplayName(newContact),
                number: newContact.number,
                action: TRIGGER_EVENT_CONTACT_ACTIONS.CREATED
              }
            }
    })
  }

  private async addGmailImportedContact(user: LoginUser, contactId: bigint, gmailAccountId: bigint, gmailId:string){
    if(!contactId){
      return;
    }

    await this.prisma.gmailImportedContact.create({
          data: {
            userId: user.parentUserId ?? user.id,
            agencyId: user.agencyId,
            createdBy: user.id,
            contactId,
            gmailAccountId: gmailAccountId,
            gmailId: gmailId
          }
      })
  }

  private async addGoogleContactLogs(user:LoginUser, parsedPhone:any, contact:any, userRequestId: bigint, status: GoogleContactLogStatus, invalidReason: string){
    return await this.prisma.googleContactLog.create({
            data: {
              userId: user.parentUserId ?? user.id,
              createdBy: user.id,
              agencyId: user.agencyId,
              userRequestId: userRequestId,
              contactId: contact.id ?? null,
              number: contact.phoneNumbers?.[0]?.canonicalForm || '',
              country: parsedPhone ? parsedPhone.country: null,
              countryCode: parsedPhone ? parsedPhone.countryCallingCode: null,
              firstName: contact.names?.[0]?.givenName || '',
              lastName: contact.names?.[0]?.familyName || '',
              email: contact.phoneNumbers?.[0]?.canonicalForm || '',
              status: status,
              invalidReason: invalidReason
            }
      })
  }
  

  private async sendNotification(user:LoginUser, title:string, message:string, importedCount: number, notificationSourceType: NotificationSourceType, navigatePath:string){
    await this.notificationService.sendToUser(
        user.id,
        user.agencyId,
        NotificationType.CONTACT_IMPORT_ALERT,
        {
          title: title,
          message: message,
          data: {
            importedCount,
            type: NotificationSourceType.SUCCESS,
            navigatePath: navigatePath,
          },
          navigatePath: navigatePath,
        }
      )
  }

  async getGoogleContactSource(agencyId: bigint) {
    // Try to find an existing Google Contacts source
    let source = await this.prisma.contactSource.findFirst({
      where: {
        agencyId,
        name: 'Google Contacts'
      }
    })

    // If not found, create one
    if (!source) {
      source = await this.prisma.contactSource.create({
        data: {
          agencyId,
          name: 'Google Contacts',
          description: 'Imported from Google Contacts'
        }
      })
    }

    return source
  }

  private getRedirectUrl(type: IntegrationType): string {
    switch (type) {
      case IntegrationType.GOOGLE_SHEETS:
        return '/integrations/google-sheets/callback'
      case IntegrationType.GOOGLE_CONTACT:
        return '/integrations/google-contact/callback'
      default:
        throw new Error(`Unsupported integration type: ${type}`)
    }
  }
}

import {
  AUTH_TYPE_GMB,
  AUTH_TYPE_GOOGLE_SERVICE,
  TUMBLR_API_BASE_URL,
  TYPE_AI,
  TYPE_FACEBOOK,
  TYPE_INSTAGRAM,
  TYPE_LINKEDIN,
  TYPE_OPENAI,
  TYPE_PINTEREST,
  TYPE_TIKTOK,
  TYPE_TUMBLR,
  TYPE_TWITTER,
} from '@/config/constant';
import { destructIntegrationstate } from '@/utils/converter';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class CommonService {
  constructor(private readonly prisma: PrismaService) { }

  async getLogo(agencyID: bigint, userId: bigint | number | null) {
    if (userId) {
      const userInfos = await this.prisma.user_infos.findFirst({
        where: { user_id: userId },
        select: { brand_logo: true },
      });
      if (userInfos?.brand_logo) return userInfos.brand_logo;
    }

    const agencyInfo = await this.prisma.agencies.findFirst({
      where: { id: agencyID },
      select: { logo: true },
    });

    return (
      agencyInfo?.logo ||
      'https://s3.amazonaws.com/slf-media/fb187de8-a8f2-4f40-a929-f6c9c4b0b6de.png'
    );
  }

  async getUserDomain(workspace_id: bigint): Promise<string> {
    const userInfo = await this.prisma.user_custom_domains.findFirst({
      where: {
        workspace_id,
        is_domain_propagated: 'YES',
      },
      select: { custom_domain: true },
    });

    return userInfo?.custom_domain || '';
  }

  async getAgencyDomain(
    agency_id: bigint,
    isCustomDomain: boolean = true,
  ): Promise<string> {
    const agencyAdmin = await this.prisma.agency_admins.findFirst({
      where: { id: agency_id },
      select: { agency_id: true },
    });
    if (!agencyAdmin) return '';

    const agencyInfo = await this.prisma.agencies.findFirst({
      where: { id: agencyAdmin.agency_id },
      select: { domain_prefix: true, custom_domain: true },
    });

    if (!agencyInfo) return '';
    return isCustomDomain && agencyInfo.custom_domain
      ? agencyInfo.custom_domain
      : `${agencyInfo.domain_prefix}.${process.env.APP_MAIN_DOMAIN}`;
  }

  async getPublicDomain(user: {
    workspace_id: bigint;
    agency_id: bigint;
  }): Promise<string> {
    const userDomain = await this.getUserDomain(user.workspace_id);
    if (userDomain) return `https://${userDomain}`;

    const agencyDomain = await this.getAgencyDomain(user.agencyId);
    return `https://${agencyDomain}`;
  }

  getIntegrationType(integrationType: string) {
    switch (integrationType) {
      case 'google_drive':
      case 'youtube':
      // case "gmb":
      case 'google':
        return AUTH_TYPE_GOOGLE_SERVICE;
      case 'gmb':
        return AUTH_TYPE_GMB;
      case 'facebook':
        return TYPE_FACEBOOK;
      case 'instagram':
        return TYPE_INSTAGRAM;
      case 'twitter':
        return TYPE_TWITTER;
      case 'tiktok':
        return TYPE_TIKTOK;
      case 'linkedin':
        return TYPE_LINKEDIN;
      case 'pinterest':
        return TYPE_PINTEREST;
      case 'tumblr':
        return TYPE_TUMBLR;
      default:
        return;
    }
  }
  async getSocialInfoCommon(team_id: bigint, types: string[]) {
    const socialInfo = await this.prisma.third_party_authentications.findMany({
      where: {
        team_id: team_id,
        is_used: true,
        type: { in: types },
      },
      select: {
        extra_info: true,
        type: true,
      },
    });

    return socialInfo.map((item) => {
      const extra_info = (item.extra_info as any) || [];
      let pages = [];
      if (item.type === TYPE_FACEBOOK) {
        // const profileImage = extra_info?.profile_image;
        pages = extra_info?.pages?.map((page) => {
          return {
            id: page.id,
            name: page.name,
            profileImage: page?.picture,
          };
        });
      }

      let groups = [];
      let organizations = [];
      let linkedInInfo;
      if (item.type === TYPE_LINKEDIN) {
        const profileImage = extra_info?.profile_image;
        linkedInInfo = {
          profileImage,
        };
        groups = extra_info?.groups?.map((group) => {
          return {
            id: group.id?.toString(),
            name: group.groupName,
            profileImage,
          };
        });
        organizations = extra_info?.companies?.map((organization) => {
          return {
            id: organization.id,
            name: organization.companyName,
            profileImage,
          };
        });
      }

      let tiktokPublishInfo;
      if (item.type === TYPE_TIKTOK) {
        tiktokPublishInfo = {
          ...extra_info?.publish_info,
          profileImage: extra_info?.profile_image,
        };
      }

      let instagramIds = [];
      if (item.type === TYPE_INSTAGRAM) {
        instagramIds = extra_info?.pages?.map((page) => {
          return {
            id: page.instagram_id,
            name: page.name,
            instagram_id: page.instagram_id || page.id,
          };
        });
      }

      let boards = [];
      if (item.type === TYPE_PINTEREST) {
        const profileImage = extra_info?.info?.profile_image;
        boards = extra_info?.boards?.map((board) => {
          return {
            id: board.id,
            name: board.name,
            profileImage,
          };
        });
      }

      let blogs = [];
      if (item.type === TYPE_TUMBLR) {
        blogs = extra_info?.blogs?.map((blog) => {
          return {
            id: blog.name,
            name: blog.name,
            profileImage: `${TUMBLR_API_BASE_URL}/blog/${blog.name}.tumblr.com/avatar`,
          };
        });
      }

      let gmbInfo;

      if (item.type === AUTH_TYPE_GMB) {
        gmbInfo = {
          // google: extra_info?.google_drive,
          // youtube: extra_info?.youtube,
          // gmail: extra_info?.gmail,
          gmb: extra_info?.gmb,
          accounts: extra_info?.gmb_account?.map((account) => {
            return {
              account_id: account?.accountId,
              locations: account?.locations?.map((location) => {
                return {
                  title: location?.title,
                  location_id: location?.locationId,
                };
              }),
            };
          }),
          profileImage:
            extra_info?.images?.gmb_profile_image ||
            extra_info?.images?.drive_profile_mage,
        };
      }
      let googleInfo;
      if (item.type === AUTH_TYPE_GOOGLE_SERVICE) {
        googleInfo = {
          google: extra_info?.google_drive,
          youtube: extra_info?.youtube,
          gmail: extra_info?.gmail,
          // gmb: extra_info?.gmb,
          // accounts: extra_info?.gmb_account?.map((account) => {
          //   return {
          //     account_id: account?.accountId,
          //     locations: account?.locations?.map((location) => {
          //       console.log("location", location);
          //       return {
          //         title: location?.title,
          //         location_id: location?.locationId
          //       };
          //     })
          //   };
          // }),
          profileImage: extra_info?.images?.drive_profile_mage,
        };
      }
      let twitterInfo;
      if (item.type === TYPE_TWITTER) {
        twitterInfo = {
          profileImage: extra_info?.profile_image,
        };
      }

      return {
        type: item.type,
        pages: pages?.length ? pages : undefined,
        instagram_ids: instagramIds?.length ? instagramIds : undefined,
        groups: groups?.length ? groups : undefined,
        organizations: organizations?.length ? organizations : undefined,
        linkedInInfo,
        tiktokPublishInfo,
        twitterInfo,
        gmbInfo,
        googleInfo,
        boards: boards?.length ? boards : undefined,
        blogs: blogs?.length ? blogs : undefined,
      };
    });
  }

  async checkIntegrationConnection(
    team_id: bigint,
    type?: string,
    aiName?: string,
  ) {
    const types = type
      ? [type]
      : [
        TYPE_FACEBOOK,
        TYPE_INSTAGRAM,
        TYPE_LINKEDIN,
        TYPE_TIKTOK,
        AUTH_TYPE_GOOGLE_SERVICE,
        AUTH_TYPE_GMB,
        TYPE_TWITTER,
        TYPE_PINTEREST,
        TYPE_TUMBLR,
      ];

    const ais = aiName ? [aiName] : [TYPE_OPENAI];

    const socialInfo = await this.prisma.third_party_authentications.findMany({
      where: {
        team_id: team_id,
        type: { in: types },
      },
      select: {
        type: true,
        is_used: true,
      },
    });

    const provider = await this.prisma.gateway_provider_settings.findMany({
      where: {
        team_id: team_id,
        provider_name: { in: ais },
        type: TYPE_AI,
        status: 'ACTIVE',
      },
      select: {
        auth_info: true,
        provider_name: true,
      },
    });

    const integrationList = socialInfo.map((item) => {
      return {
        type: item.type,
        isConnected: item.is_used,
      };
    });

    const aiList = provider.map((item) => {
      return {
        type: item.provider_name,
        isConnected: !!item.auth_info,
      };
    });

    return {
      integrations: integrationList,
      ais: aiList,
    };
  }

  async validateAuthorization(
    state: string,
    failedRedirectUrl: string,
  ): Promise<
    | {
      user: { agency_id: bigint; team_id: bigint; id: bigint };
      isCustomDomain: boolean;
    }
    | any
  > {
    if (!state) {
      return false;
    }
    const { apiKey, isCustomDomain } = destructIntegrationstate(state);
    const user = await this.prisma.users.findFirst({
      where: {
        api_key: apiKey,
      },
      select: {
        agency_id: true,
        team_id: true,
        id: true,
      },
    });

    if (!user) {
      return false;
    }

    return {
      user,
      isCustomDomain,
    };
  }

  prepareTemplateCreatorMailBody({
    loginLink,
    name,
    password,
    email,
  }: {
    loginLink: string;
    name: string;
    password: string;
    email: string;
  }) {
    return `<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <title>Welcome to super localfans</title>
  </head>
  <body
    style="font-family: Poppins, Arial, sans-serif"
    data-new-gr-c-s-check-loaded="14.1193.0"
    data-gr-ext-installed=""
  >
    <table
      width="100%"
      cellspacing="0"
      cellpadding="0"
      style="background-color: #dcdcdc; padding-top: 50px"
    >
      <tbody>
        <tr>
          <td align="center" style="padding-bottom: 5px">
            <table
              class="frontbody"
              width="800px"
              height="100%"
              cellspacing="0"
              cellpadding="0"
              style="
                background-color: #280000;
                border-radius: 30px;
                position: relative;
              "
            >
              <!-- Header -->
              <tbody>
                <tr>
                  <td
                    class="email_container_imgBox"
                    style="
                      text-align: center;
                      height: 300px;
                      width: 100%;
                      border-top-left-radius: 30px;
                      border-top-right-radius: 30px;
                    "
                  >
                    <img
                      style="
                        width: 100%;
                        border-top-left-radius: 30px;
                        border-top-right-radius: 30px;
                      "
                      src="https://s3.amazonaws.com/slf-media/29/profile/41467b49-3833-48e5-9a06-d96ea3d49b22.png"
                      alt="placeholder"
                    />
                  </td>
                </tr>
                <tr>
                  <td>
                    <table
                      class="content"
                      width="90%"
                      cellspacing="0"
                      cellpadding="0"
                      style="
                        background-color: hsla(0, 0%, 0%, 0.404);
                        text-align: center;
                        border-radius: 8px;
                        margin-top: -100px;
                        margin-left: auto;
                        margin-right: auto;
                        backdrop-filter: blur(8px);
                        border: 1px solid #ffffff23;
                        padding-top: 60px;
                        padding-left: 30px;
                        padding-bottom: 60px;
                      "
                    >
                      <tbody>
                        <tr>
                          <td
                            class="heading"
                            style="
                              font-weight: 400;
                              text-align: left;
                              color: #fff;
                              font-family: Helvetica, sans-serif;
                              font-size: 20px;
                              letter-spacing: -1px;
                              line-height: 24px;
                            "
                          >
                            Hi ${name || ''},
                          </td>
                        </tr>
                        <tr>
                          <td
                            class="para"
                            style="
                              font-family: inter;
                              line-height: 24px;
                              font-size: 16px;
                              font-weight: 400;
                              text-align: left;
                              letter-spacing: -0.15px;
                              margin-top: 20px;
                              color: #f5f1f2;
                              padding-top: 20px;
                            "
                          >
                            We’re thrilled to have you join
                            <span
                              style="
                                text-decoration: underline;
                                font-weight: 500;
                                font-size: 16px;
                              "
                              >DesignSphere creators League</span
                            >
                            as a template creator! Your account has been
                            successfully set up, and you’re all set to get
                            started.
                          </td>
                        </tr>
                        <tr>
                          <td
                            style="
                              font-family: inter;
                              font-size: 15px;
                              font-weight: 700;
                              line-height: 20px;
                              letter-spacing: -0.15px;
                              color: #f5f1f2;
                              padding-top: 30px;
                              text-align: left;
                            "
                          >
                            Here are your login details:
                          </td>
                        </tr>
                        <tr>
                          <td
                            style="
                              font-family: inter;
                              font-size: 15px;
                              font-weight: 700;
                              line-height: 20px;
                              letter-spacing: -0.15px;
                              color: #e40123;
                              text-align: left;
                              padding: 5px 0px 5px;
                            "
                          >
                            Email:
                            <span
                              style="
                                font-weight: 400;
                                font-size: 15px;
                                line-height: 20px;
                                letter-spacing: -0.15px;
                                color: #f5f1f2;
                                text-decoration: none;
                              "
                              ><a
                                href="#"
                                style="color: #fff; text-decoration: none"
                              >${email}</a
                              ></span
                            >
                          </td>
                        </tr>
                        <tr>
                          <td
                            style="
                              font-family: inter;
                              font-size: 15px;
                              font-weight: 700;
                              line-height: 20px;
                              letter-spacing: -0.15px;
                              color: #e40123;
                              text-align: left;
                            "
                          >
                            Password:
                            <span
                              style="
                                font-weight: 400;
                                font-size: 15px;
                                line-height: 20px;
                                letter-spacing: -0.15px;
                                color: #f5f1f2;
                              "
                              >${password}</span
                            >
                          </td>
                        </tr>
                        <tr>
                          <td
                            style="
                              font-family: inter;
                              font-weight: 400;
                              font-size: 15px;
                              line-height: 20px;
                              letter-spacing: -0.15px;
                              color: #f5f1f2;
                              text-align: left;
                              padding-top: 30px;
                            "
                          >
                            To dive right in, click the button below to log in
                            to your account:
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <table
                              cellspacing="0"
                              cellpadding="0"
                              align="left"
                              style="margin-top: 30px; padding-top: 10px"
                            >
                              <tr>
                                <td
                                  align="center"
                                  style="
                                    background-color: #e40123;
                                    padding: 13px 13px 13px 28px;
                                    border-radius: 30px;
                                    font-size: 18px;
                                    text-decoration: none;
                                    color: #fff;
                                    cursor: pointer;
                                  "
                                >
                                  <a
                                    href="${loginLink}"
                                    target="_blank"
                                    style="
                                      font-family: inter;
                                      font-size: 18px;
                                      color: #ffffff;
                                      text-decoration: none;
                                      line-height: 20px;
                                      letter-spacing: -0.35px;
                                      vertical-align: middle;
                                      font-weight: 600;
                                    "
                                    >Login to Your Account
                                    <span
                                      style="
                                        display: inline-block;
                                        height: 30px;
                                        width: 30px;
                                        border-radius: 50%;
                                        background-color: white;
                                        color: #e40123;
                                        margin-left: 10px;
                                        text-align: center;
                                        vertical-align: middle;
                                        font-size: 20px;
                                      "
                                    >
                                      <img
                                        style="
                                          margin-top: 25%;
                                          height: 15px;
                                          width: 15px;
                                        "
                                        src="https://s3.amazonaws.com/slf-media/29/profile/6987f610-a60f-4d2f-9511-c44ded0fa6e3.png"
                                        alt="arrow"
                                      />
                                    </span>
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td
                            style="
                              font-family: inter;
                              font-size: 15px;
                              font-weight: 400;
                              line-height: 20px;
                              letter-spacing: -0.15px;
                              color: #f5f1f2;
                              text-align: left;
                              padding-top: 30px;
                            "
                          >
                            If you have any questions or need help along the
                            way, our support team is always here for you. Just
                            hit us up, and we’ll be happy to assist.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td>
                    <table
                      cellspacing="0"
                      cellpadding="0"
                      align="center"
                      width="70%"
                      style="margin: 40px auto"
                    >
                      <tr>
                        <td
                          style="
                            font-family: inter;
                            font-size: 16px;
                            font-weight: 400;
                            line-height: 25.6px;
                            color: #f5f1f2;
                            text-align: center;
                            padding-top: 40px;
                          "
                        >
                          Thank you for being part of the
                          <span
                            style="
                              font-family: inter;
                              font-size: 16px;
                              font-weight: 600;
                              line-height: 25.6px;
                              text-align: center;
                              text-decoration: underline;
                            "
                            >DesignSphere creators League</span
                          >
                          community! We can’t wait to see the amazing templates
                          you’ll create.
                        </td>
                      </tr>
                      <tr>
                        <td
                          align="center"
                          style="
                            font-family: Inter;
                            font-weight: 400;
                            font-size: 16px;
                            color: #f5f1f2;
                            line-height: 25.6px;
                            padding-top: 24px;
                          "
                        >
                          Best Regards,<br /><span
                            style="
                              font-family: Inter;
                              font-weight: 500;
                              font-size: 16px;
                              color: #f5f1f2;
                              line-height: 25.6px;
                              padding-top: 5px;
                            "
                            >Super Local Fans Team</span
                          >
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table
                      style="
                        width: 100%;
                        height: 60px;
                        background-color: #100a0a;
                        margin-top: 100px;
                        padding: 0 20px;
                        border-top: 1px solid #ffffff23;
                      "
                    >
                      <tr>
                        <td
                          align="left"
                          style="
                            font-family: inter;
                            font-weight: 400;
                            font-size: 15px;
                            line-height: 20px;
                            letter-spacing: -0.15px;
                            color: #9f9d9d;
                          "
                        >
                          Powered by Superlocalfans
                        </td>
                        <td
                          align="right"
                          style="
                            font-family: inter;
                            font-weight: 400;
                            font-size: 15px;
                            line-height: 20px;
                            letter-spacing: -0.15px;
                            color: #9f9d9d;
                          "
                        >
                          Terms & Conditions
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 50px"></td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`;
  }
}

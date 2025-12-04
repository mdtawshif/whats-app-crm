import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { GetAllDto, GetAllShortDto, TemplateCreationDto } from '../dto/wa.message.template.dto';
import { LoginUser } from 'src/modules/auth/dto/login-user.dto';
import { ICreateMessageTemplate } from '@/common/wa-helper/interface.dt';
import { TemplateCategory, TemplateStatus } from '@prisma/client';
import { MetaOAuthTokenService } from './meta.oauth.token.service';
import { WaHelperService } from './wa-helper.service';
import { deleteMessageTemplate, updateMessageTemplate } from '@/common/wa-helper/wa-helper';

@Injectable()
export class MessageTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metaOAuthTokenService: MetaOAuthTokenService,
    private readonly waHelperService: WaHelperService,
  ) { }

  async getAllShorTemplates(args: { query: GetAllShortDto, user: LoginUser }) {

    const payload = {};

    payload['userId'] = args.user.id;

    payload['category'] = { in: [TemplateCategory.MARKETING, TemplateCategory.UTILITY] };
    
    payload['status'] = TemplateStatus.APPROVED;

    if (args.query.wabaId) {
      payload['wabaId'] = args.query.wabaId //Array.isArray(args.query.wabaIds) ? {in: args.query.wabaIds} : args.query.wabaIds;
    }
    if (args.query.search) {
      payload['name'] = { contains: args.query.search }
    }

    const [templates] = await this.prisma.$transaction([
      this.prisma.messageTemplate.findMany({
        where: payload,
        select: {
          id: true,
          name: true,
        },
        orderBy: { id: 'desc' },
      })
    ]);

    return {
      status: 200,
      message: "Message template fetched successfully.",
      data: templates
    };
  }

  async getAllTemplates(args: { query: GetAllDto, user: LoginUser }) {
    const payload = {};
    payload['userId'] = args.user.id;
    if (args.query.category) {
      payload['category'] = args.query.category;
    }
    if (args.query.status) {
      payload['status'] = args.query.status;
    }
    if (args.query.wabaId) {
      payload['wabaId'] = args.query.wabaId //Array.isArray(args.query.wabaIds) ? {in: args.query.wabaIds} : args.query.wabaIds;
    }
    if (args.query.search) {
      payload['name'] = { contains: args.query.search }
    }

    const skip = (parseInt(args.query.page) - 1) * parseInt(args.query.perPage);
    const [templates, totalCount] = await this.prisma.$transaction([
      this.prisma.messageTemplate.findMany({
        where: payload,
        select: {
          id: true,
          messageId: true,
          wabaId: true,
          name: true,
          category: true,
          language: true,
          components: true,
          status: true
        },
        skip: skip,
        take: parseInt(args.query.perPage),
        orderBy: { id: 'desc' },
      }),
      this.prisma.messageTemplate.count({
        where: payload,
      }),
    ]);
    const totalPages = Math.ceil(totalCount / parseInt(args.query.perPage));

    return {
      status: 200,
      message: "Message template fetched successfully.",
      data: templates,
      extraData: { totalPages, totalCount }
    };
  }

  async addTemplate({ data, user, wabaId, res }: { data: ICreateMessageTemplate; user: LoginUser; wabaId: string, res: { id: string; status: string; category: string; } }) {
    return await this.prisma.messageTemplate.create({
      data: {
        userId: user.id,
        agencyId: user.agencyId as bigint,
        messageId: res.id,
        wabaId: wabaId,
        language: data.language,
        name: data.name,
        status: res.status as TemplateStatus,
        components: {
          components: data.components
        } as any,
        category: (res.category || data.category) as TemplateCategory
      }
    })
  }

  async deleteMessageTemplate(id: bigint, user: LoginUser){
    const data = await this.prisma.messageTemplate.findFirst({
      where: {id: id},
      select: {
        messageId: true,
        name: true,
        wabaId: true,
      }
    })
    if(data){
      const accessToken = await this.waHelperService.getWithRefreshToken(user.id);
      if(accessToken && accessToken.token){
        const deleteRes = await deleteMessageTemplate({
          templateId: data.messageId,
          templateName: data.name,
          token: accessToken.token,
          wabaId: data.wabaId
        });
        if(deleteRes){
          await this.prisma.messageTemplate.delete({
            where:{ id: id }
          })
          return {
            status: true,
            message: 'Template delete successfully'
          }
        }
        return {
          status: false,
          message: 'Can not delete this template. Internal server error'
        }
      }
      return {
        status: false,
        message: accessToken.message
      }
      
    }
    return {
      status: false,
      message: "No data found for this template"
    }
  }

  async updateMessageTemplate(id: bigint, payload: ICreateMessageTemplate, user: LoginUser){
    const data = await this.prisma.messageTemplate.findFirst({
      where: {id: id},
      select: {
        messageId: true,
        name: true,
        wabaId: true,
      }
    })
    if(data){
      const accessToken = await this.waHelperService.getWithRefreshToken(user.id);
      if(accessToken && accessToken.token){
        const templateName = payload.name.replaceAll(' ', '_').toLowerCase();
        const deleteRes = await updateMessageTemplate({
          templateId: data.messageId,
          token: accessToken.token,
          data: {
            name: templateName,
            components: payload.components,
            language: payload.language,
            category: payload.category
          }
        });
        if(deleteRes){
          await this.prisma.messageTemplate.update({
            where:{ id: id },
            data: {
              components: {
                components: payload.components
              } as any,
              category: payload.category as TemplateCategory,
              name: templateName,
              status: TemplateStatus.PENDING,
              language: payload.language
            }
          })
          return {
            status: true,
            message: 'Template updated successfully'
          }
        }
        return {
          status: false,
          message: 'Can not update this template. Internal server error'
        }
      }
      return {
        status: false,
        message: accessToken.message
      }
      
    }
    return {
      status: false,
      message: "No data found for this template"
    }
  }

  /* for cron job */
  async getMetaMessageTemplate() {
    // const accessToken = await this.waHelperService.getWithRefreshToken();

    /* get data from job table: meta_data_sync_jobs */
    /* get access token */
    /* get waba account */
    /* get message template by waba id */
  }

  /**
   * @param id 
   * @returns 
   */
  async getMessageTemplateById(id: bigint){
    if(id == null){
      return null;
    }
    try{
      return await this.prisma.messageTemplate.findFirst({
        where:{
          id: id
        }
      })
    }catch(error){
      
    }
  }

async addMessageTemplate(user: LoginUser, templateCreationDto: TemplateCreationDto) {
  
  try{
      return await this.prisma.messageTemplate.create({
        data: {
          userId: user.id,
          agencyId: user.agencyId as bigint,
          messageId: templateCreationDto.templateId,
          wabaId: templateCreationDto.wabaId,
          language: templateCreationDto.language,
          name: templateCreationDto.friendly_name,
          status: TemplateStatus.PENDING,
          components: templateCreationDto as any,
          category: templateCreationDto.category
        }
      })
    }catch(error){
      /**
       * 
       */
    }
  }

  async findUserTemplateByName(userId: bigint, name: string, wabaId: string) {
    try{
        return await this.prisma.messageTemplate.findFirst({
          where:{
            userId:userId,
            wabaId: wabaId,
            name:name,
          }
        })
      }catch(error){
        /**
         * 
         */
      }
  }
}

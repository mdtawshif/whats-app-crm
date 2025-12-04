import { META_LANGUAGE } from "@/common/constants/meta-timezone.constant";
import { ApiProperty } from "@nestjs/swagger";
import { TemplateCategory, TemplateStatus } from "@prisma/client";
import { IsArray, IsEnum, IsIn, IsNotEmpty, isNotEmpty, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { ITemplateComponent } from "../interface/wab.message.template.info.interface";
import { IsValidComponents } from "../decorator/is-valid-components.decorator";
import { Type } from "class-transformer";

export class GetAllDto {
  @ApiProperty({required: false})
  @IsEnum(['MARKETING', 'UTILITY', 'AUTHENTICATION'])
  @IsOptional()
  category?: TemplateCategory;
  
  @ApiProperty({required: false})
  @IsEnum(['PENDING', 'APPROVED', 'REJECTED'])
  @IsOptional()
  status?: TemplateStatus;
  
  // @ApiProperty({required: false})
  // @IsOptional()
  // wabaIds?: string[];

  @ApiProperty()
  @IsString()
  wabaId: string;

  @ApiProperty()
  @IsString()
  page: string;

  @ApiProperty()
  @IsString()
  perPage: string;

  @ApiProperty({required: false})
  @IsOptional()
  search?: string;
}

export class GetAllShortDto {

  @ApiProperty({required: false})
  @IsOptional()
  search?: string;

  @ApiProperty({required: true})
  @IsNotEmpty()
  wabaId: string

}

export class AddTemplateDto {
  @ApiProperty()
  @IsString()
  wabaId: string;
  
  @ApiProperty({
    description: 'Name of the template',
    maxLength: 512,
    example: 'Quick reply'
  })
  @IsString()
  @MaxLength(512, { message: 'Name must not be longer than 512 characters' })
  name: string;

  @ApiProperty({
    enum: TemplateCategory,
    enumName: 'TemplateCategory',
    description: 'Template category',
    example: TemplateCategory.MARKETING,
  })
  @IsEnum(TemplateCategory, {
    message: 'category must be one of: MARKETING, UTILITY, AUTHENTICATION',
  })
  category: TemplateCategory;

  @ApiProperty({
    description: 'Language code',
    enum: Object.values(META_LANGUAGE),
    example: 'af',
  })
  @IsString()
  @IsIn(Object.values(META_LANGUAGE), {
    message: `Language must be one of: ${Object.values(META_LANGUAGE).join(', ')}`,
  })
  language: string;

  /* component body */
  @ApiProperty({
    description: 'Component properties',
    example: `
      [
        {
          "type": "HEADER",
          "format": "TEXT",
          "text": "Our {{1}} is on!",
          "example": {
            "header_text": [
              "Summer Sale"
            ]
          }
        },
        {
          "type": "BODY",
          "text": "Shop now through {{1}} and use code {{2}} to get {{3}} off of all merchandise.",
          "example": {
            "body_text": [
              [
                "the end of August","25OFF","25%"
              ]
            ]
          }
        },
        {
          "type": "FOOTER",
          "text": "Use the buttons below to manage your marketing subscriptions"
        },
        {
          "type":"BUTTONS",
          "buttons": [
            {
              "type": "QUICK_REPLY",
              "text": "Unsubscribe from Promos"
            },
            {
              "type":"QUICK_REPLY",
              "text": "Unsubscribe from All"
            }
          ]
        }
      ]
    `,
  })
  @IsArray()
  @IsValidComponents() 
  components: ITemplateComponent['components'];
}

/**
 * whats app template creation dto using twilio
 */
/**
 * @Sample request
 * {
      "friendly_name":"ot_business",
      "wabaId": "string",
      "category": "MARKETING",
      "variables":{
          "first_name":"Jhon ",
          "last_name":"Smith",
          "email":"jhon@gmail.com"
      },
      "language":"en",
      "types":{
          "whatsapp/card":{
            "body":"Hi  {{first_name}} {{last_name}} Thanks for joining our wagent.If you have any query please send us mail on {{email}}",
            "footer":"Join Our Wagent",
            "actions":[
                {
                  "type":"QUICK_REPLY",
                  "title":"Reply",
                  "id":"reply_button"
                },
                {
                  "type":"PHONE_NUMBER",
                  "title":"Call Us",
                  "phone":"+12345678901"
                }
            ],
            "media":[
                "https://picsum.photos/536/354"
            ]
          }
      },
      "sid":"",
      "date_updated":"",
      "date_created":"",
      "account_sid":"",
      "approval_requests":{
          
      }
    }
 */

/**
 * @Represents an interactive action (button) in a Twilio WhatsApp template.
 * @Defines the properties of a template button, including its type
 * (e.g., QUICK_REPLY, PHONE_NUMBER)
 */
export class TemplateAction {
  @ApiProperty({ description: 'Action type', example: 'QUICK_REPLY' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Button title', example: 'Reply' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Button ID (for quick reply type)', required: false, example: 'reply_button' })
  @IsString()
  id?: string;

  @ApiProperty({ description: 'Phone number (for call type)', required: false, example: '+12345678901' })
  @IsString()
  @IsOptional() 
  phone?: string;

  @ApiProperty({ description: 'Phone number (for call type)', required: false, example: '+12345678901' })
  @IsString()
  @IsOptional() 
  url?: string; 
}

/**
 * @Represents the content structure of a Twilio WhatsApp template.
 * @Defines the layout and elements of a WhatsApp message template,
 * @Including the message body, footer text, interactive actions (buttons),
 */
export class TemplateContent {
  @ApiProperty({
    description: 'Message body text with variables',
    example: 'Hi {{first_name}} {{last_name}} Thanks for joining our wagent...',
  })
  @IsString()
  body: string;

  @ApiProperty({ description: 'Footer text', example: 'Join Our Wagent' })
  @IsString()
  @IsOptional()
  footer: string;

  @ApiProperty({ description: 'List of actions (buttons)', type: [TemplateAction] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateAction)
  @IsOptional()
  actions: TemplateAction[];

  @ApiProperty({ description: 'Media URLs', example: ['https://picsum.photos/536/354'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  media: string[];

  @ApiProperty({ description: 'Header text', example: 'Join Our Wagent to explore it' })
  @IsString()
  @IsOptional()
  header_text: string
}


/**
 * @Defines the supported WhatsApp message type structures for a Twilio template.
 * @Message types such as text, image, or media templates.
 */
export class TemplateTypes {
  @ApiProperty({
    description: 'WhatsApp card template definition',
    type: TemplateContent,
  })
  @ValidateNested()
  @Type(() => TemplateContent)
  ['whatsapp/card']: TemplateContent;
}

/**
 * @DTO for creating a new WhatsApp template using Twilio.
 * @Defines the structure and validation rules for the template creation payload,
 * including details such as template metadata, category, language, variables, and message content types.
 */
export class TemplateCreationDto {
  
  @ApiProperty({
    description: 'Friendly name for the template',
    example: 'ot_business'
  })
  @IsString()
  @IsNotEmpty()
  friendly_name: string

  @IsOptional()
  templateId: string

  @ApiProperty({
    description: 'WhatsApp Business Account ID (WABA ID)',
    example: '123456789'
  })
  @IsString()
  @IsNotEmpty()
  wabaId: string

  @ApiProperty({
    enum: TemplateCategory,
    enumName: 'TemplateCategory',
    description: 'Template category',
    example: TemplateCategory.MARKETING
  })
  @IsEnum(TemplateCategory, {
   message: 'category must be one of: MARKETING, UTILITY, AUTHENTICATION'
  })
  category: TemplateCategory

  @ApiProperty({
    description: 'Language code',
    enum: Object.values(META_LANGUAGE),
    example: 'en'
  })
  @IsString()
  language: string

  @ApiProperty({
    description: 'Variables used in template body',
    example: { first_name: 'John', last_name: 'Smith', email: 'john@gmail.com' },
  })
  @IsObject()
  @IsOptional()
  variables: Record<string, string>;

  @ApiProperty({
    description: 'Message type structure for WhatsApp template',
    type: TemplateTypes,
  })
  @ValidateNested()
  @Type(() => TemplateTypes)
  types: TemplateTypes;
  
}






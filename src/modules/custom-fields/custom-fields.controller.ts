import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { LoginUser } from "../auth/dto/login-user.dto";
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Request, UseGuards } from "@nestjs/common";
import { CustomFieldsService } from "./custom-fields.service";
import { AuthGuard } from "@/common/guard/auth.guard";
import { CreateCustomFieldDto, GetCustomFieldsDto, UpdateCustomFieldDto } from "./dto/create-custom-field.dto";


@ApiTags("Custom-fields")
@Controller("custom-fields")
export class CustomFieldsController {
    constructor(
        private readonly contactService: CustomFieldsService,
    ) { }

    @ApiBearerAuth()
    @Post('')
    @UseGuards(AuthGuard)
    async createCustomField(@Request() req: { user: LoginUser }, @Body() dto: CreateCustomFieldDto) {
        return this.contactService.createCustomField(req.user, dto);
    }

    // update custom field
    @ApiBearerAuth()
    @Put(':id')
    @UseGuards(AuthGuard)
    async updateCustomField(@Request() req: { user: LoginUser }, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomFieldDto) {
        return this.contactService.updateCustomField(req.user, id, dto);
    }

    // delete custom field
    @ApiBearerAuth()
    @Delete(':id')
    @UseGuards(AuthGuard)
    async deleteCustomField(@Request() req: { user: LoginUser }, @Param('id', ParseIntPipe) id: number) {
        return this.contactService.deleteCustomField(req.user, id);
    }

    // get custom fields
    @ApiBearerAuth()
    @Get('lists')
    @UseGuards(AuthGuard)
    async getCustomFields(@Request() req: { user: LoginUser },
        @Query('type') type?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('label') label?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortOrder') sortOrder?: 'asc' | 'desc'
    ) {
        return this.contactService.getCustomFields(
            req.user,
            {
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
                label,
                sortBy,
                sortOrder,
                type
            }
        );
    }

    // get all the custom fields for a contact
    @ApiBearerAuth()
    @Get('for-contact')
    @UseGuards(AuthGuard)
    async getContactCustomFields(@Request() req: { user: LoginUser },) {
        return this.contactService.getCustomFieldsForContact(req.user);
    }

}
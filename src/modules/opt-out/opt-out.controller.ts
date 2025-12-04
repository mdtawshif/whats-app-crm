import { Body, Controller, Delete, Get, Post, Query, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { OptOutService } from "./opt-out.service";
import { AuthGuard } from "@/common/guard/auth.guard";
import { AddContactsToOptOutDto, GetOptOutContactsDto, RemoveContactsFromOptOutDto } from "./dto/create-opt-out";
import { LoginUser } from "../auth/dto/login-user.dto";

@ApiTags("opt-out")
@Controller("opt-out")
export class OptOutController {
    constructor(
        private readonly optOutService: OptOutService,
    ) { }

    // add contacts to opt-out controller
    @ApiBearerAuth()
    @Post('add')
    @UseGuards(AuthGuard)
    async createOptOut(@Request() req: { user: LoginUser }, @Body() dto: AddContactsToOptOutDto) {
        return await this.optOutService.addContactsToOptOut(req.user, dto);
    }

    // remove contacts from opt-out controller
    @ApiBearerAuth()
    @Delete('remove')
    @UseGuards(AuthGuard)
    async removeContactsFromOptOut(@Request() req: { user: LoginUser }, @Body() dto: RemoveContactsFromOptOutDto) {
        return await this.optOutService.removeContactsFromOptOut(req.user, dto);
    }

    // get all opt-out contacts controller with dynamic pagination
    @ApiBearerAuth()
    @Get('contact-list')
    @UseGuards(AuthGuard)
    async getAllOptOutContacts(@Request() req: { user: LoginUser }, @Query() dto: GetOptOutContactsDto) {
        return await this.optOutService.getAllOptOutContacts(req.user, dto);
    }
}
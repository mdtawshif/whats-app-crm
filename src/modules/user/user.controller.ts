import {
  Body,
  Controller,
  Get,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AutoRechargeDto,
  AutoRechargeSettingsDto,
  UpdateUserProfileDto,
} from './dto/update-user.dto';
import { UserService } from './user.service';
import { MyProfileDto } from './dto/get-user.dto';
import { LoginUser } from '../auth/dto/login-user.dto';
import { AuthGuard } from '../../common/guard/auth.guard';
import { ActivateUserDto } from './dto/user.dto';
import { UserListItemDto, UserListParamDto } from './dto/user-list-item-dto';
import { ApiListResponseDto } from '../../common/dto/api-list-response.dto';
@ApiTags('User')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @ApiBearerAuth()
  @Get()
  @UseGuards(AuthGuard)
  async userList(@Request() request: { user: LoginUser }, @Query() query: UserListParamDto): Promise<ApiListResponseDto<UserListItemDto>> {
    return this.userService.userList(request.user, query);
  }

  @ApiBearerAuth()
  @Get('my-profile')
  @UseGuards(AuthGuard)
  async myProfile(@Query() user: MyProfileDto) {
    return this.userService.myProfile(user);
  }

  @ApiBearerAuth()
  @Put('update-profile')
  @UseGuards(AuthGuard)
  async updateProfile(
    @Request() request: { user: LoginUser },
    @Body() dto: UpdateUserProfileDto,
  ) {
    return this.userService.updateUserProfile(request.user, dto);
  }

  @ApiBearerAuth()
  @Put('enable-auto-recharge')
  @UseGuards(AuthGuard)
  async enableAutoRecharge(
    @Request() request: { user: LoginUser },
    @Body() dto: AutoRechargeDto,
  ) {
    return this.userService.enableAutoRecharge(request.user, dto);
  }

  @ApiBearerAuth()
  @Get('get-auto-recharge-info')
  @UseGuards(AuthGuard)
  async getAutoRechargeInfo(@Request() request: { user: LoginUser }) {
    return this.userService.getAutoRechargeInfo(request.user);
  }

  @ApiBearerAuth()
  @Get('admins')
  @UseGuards(AuthGuard)
  async getAdmins(@Request() request: { user: LoginUser }) {
    return this.userService.getAdmins(request.user);
  }

  @ApiBearerAuth()
  @Put('auto-recharge-settings')
  @UseGuards(AuthGuard)
  async updateAutoRechargeSettings(
    @Request() request: { user: LoginUser },
    @Body() dto: AutoRechargeSettingsDto,
  ) {
    return this.userService.updateAutoRechargeSettings(request.user, dto);
  }

  @ApiBearerAuth()
  @Get('user-card-info')
  @UseGuards(AuthGuard)
  async getUserCardInfo(@Request() request: { user: LoginUser }) {
    return this.userService.getUserCardInfo(request.user);
  }

  @ApiBearerAuth()
  @Put('activate-user')
  @UseGuards(AuthGuard)
  async activateUser(
    @Body() dto: ActivateUserDto
  ) {
    return this.userService.activateUser(dto);
  }

}

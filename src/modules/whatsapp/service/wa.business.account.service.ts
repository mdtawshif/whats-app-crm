import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class WaBusinessAccountService {
  constructor(
    private readonly prisma: PrismaService
  ) {}

  async getNameAndIdByUser(userId: bigint){
    return await this.prisma.waBusinessAccount.findMany({
      where: { userId: userId, status: 'ACTIVE' },
      select: {
        name: true,
        wabaId: true
      },
    });
  }

  async findWaBusinessAccountById(id: bigint){
    if(id == null){
      return null;
    }
    try{
      return this.prisma.waBusinessAccount.findFirst({
        where:{
          id:id
        }
      })
    }catch(error){

    }
  }

}

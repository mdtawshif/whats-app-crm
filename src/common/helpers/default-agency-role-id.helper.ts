import { AgencyStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get role by name
 */
export async function getRole(roleName: string) {
  return await prisma.role.findFirst({
    where: { name: roleName },
  });
}

/**
 * Get or create agency by name
 */
export async function getAgency(agencyName: string) {
  let agency = await prisma.agency.findFirst({
    where: { name: agencyName },
  });

  return agency
    ? agency
    : await prisma.agency.create({
        data: {
          name: agencyName,
          status: AgencyStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
}

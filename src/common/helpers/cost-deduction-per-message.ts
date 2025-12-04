import { PrismaClient, PricingMessageType, TransactionType, InOut, PriceType, UserPackageStatus, UserPackage, User } from '@prisma/client';

const prisma = new PrismaClient();

interface DeductCostParams {
  userId: bigint;
  createdBy: bigint;
  contactId?: bigint;
  agencyId: bigint;
  conversationId?: bigint;
  broadcastId?: bigint;
  broadcastSettingId?: bigint;
  messageType: PricingMessageType;
  isSuccess: boolean;
  note?: string;
  transactionFor?: string;
  inOut: InOut
}

export async function deductMessageCost(params: DeductCostParams) {
  const {
    userId,
    agencyId,
    messageType,
    isSuccess,
    note,
    transactionFor,
    inOut,
    contactId,
    conversationId,
    broadcastId,
    broadcastSettingId,
    createdBy } = params;

  const userPackage = await prisma.userPackage.findFirst({
    where: {
      userId: userId, status: {
        in: [UserPackageStatus.ACTIVE, UserPackageStatus.TRIALING]
      }
    }
  });

  if (!userPackage) {
    console.log("Deduction blocked due to userPackage being null");
    return;
  }

  const messagingPricing = await prisma.messagingPricing.findFirst({
    where: {
      packageId: userPackage.packageId,
      messageType: messageType,
      inOut: inOut
    },
  });

  if (!messagingPricing) {
    console.log(`No messaging pricing found for packageId=${userPackage.packageId}, messageType=${messageType}, inOut=${inOut}`);
    return;
  }

  let costAmount: number;
  if (messagingPricing.priceType === PriceType.PRICE) {
    costAmount = messagingPricing.price;
  } else {
    //costAmount = Number(user.currentCredit) * (messagingPricing.price / 100);
  }

  if (!isSuccess) {
    console.log("Deduction blocked due to isSuccess being false");
    return;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      currentCredit: { decrement: costAmount }
    }
  });

  const transaction = await prisma.billingTransaction.create({
    data: {
      userId,
      agencyId,
      contactId: contactId ?? null,
      conversationId: conversationId ?? null,
      broadcastId: broadcastId ?? null,
      broadcastSettingId: broadcastSettingId ?? null,
      createdBy: createdBy ?? null,
      messagingPricingId: messagingPricing.id ?? null,
      type: inOut === InOut.OUT ? TransactionType.OUT : TransactionType.IN,
      creditAmount: costAmount,
      transactionFor: transactionFor || "Message Sent",
      billingPackageId: userPackage.packageId,
      note
    }
  });

  return { updatedUser, transaction };
}

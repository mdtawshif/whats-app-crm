import { Injectable } from "@nestjs/common";
import { Contact, ContactImportQueue, ContactImportQueueLog, ContactImportQueueLogStatus, ContactStatus, NumberStatus } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "nestjs-prisma";
import { BasicUser } from "src/modules/user/dto/user.dto";

/**
 * @Milton463
 */
@Injectable()
export class ContactUploadHelperService {

    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: PinoLogger,
     ){
        this.logger.setContext(ContactUploadHelperService.name)
    }

    async buildContactAndAddContact(user:BasicUser, transformedContact: any, contactImportQueue: ContactImportQueue, sourceId: bigint): Promise<bigint> {
            // Build contact object

            const birthDate = this.parseDateString(transformedContact.birthDate);
            const anniversaryDate = this.parseDateString(transformedContact.anniversaryDate);

            const contact: Contact = {
                userId: user.parentUserId ?? user.id,
                agencyId: user.agencyId,
                sourceId,
                number: transformedContact.number,
                createdBy: user.id,
                firstName: transformedContact.firstName || null,
                lastName: transformedContact.lastName || null,
                email: transformedContact.email || null,
                city: transformedContact.city || null,
                state: transformedContact.state || null,
                country: contactImportQueue.country || 'US',
                countryCode: contactImportQueue.countryCode || '1',
                address: transformedContact.address || null,
                status: ContactStatus.ACTIVE,
                numberStatus: NumberStatus.PENDING_VERIFICATION,
                birthDate: birthDate || null,
                birthYear: birthDate ? birthDate.getFullYear() : null,
                birthMonth: birthDate ? birthDate.getMonth() +1 : null,
                birthDay: birthDate ? birthDate.getDate() : null,
                anniversaryDate: anniversaryDate || null,
                anniversaryYear: anniversaryDate ? anniversaryDate.getFullYear() : null,
                anniversaryMonth: anniversaryDate ? anniversaryDate.getMonth() + 1 : null,
                anniversaryDay: anniversaryDate? anniversaryDate.getDate() : null,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as Contact;

        const insertedContact = await this.prisma.contact.create({
            data: contact
        });
        return insertedContact ? insertedContact.id : null;
    }

    private parseDateString(value: any): Date | null {
        if (!value) return null;
        if (value instanceof Date) {
            return !isNaN(value.getTime()) ? value : null;
        }
        const cleanValue = typeof value === 'string' ? value.replace(/_+\d+$/, '') : value;

        const date = new Date(cleanValue);
        return !isNaN(date.getTime()) ? date : null;
    }

    async processExistingContact(user:BasicUser, contactImportQueue:ContactImportQueue, existingContact: Contact, contact:any, fieldMappings: any){
        if (fieldMappings.configs.skipDuplicates){
            await this.addImportContactQueueLog(user, contact, contactImportQueue, ContactImportQueueLogStatus.DUPLICATE);
            return;
        }
        
        const updatableFields = [
            "firstName",
            "lastName",
            "email",
            "number",
            "country",
            "countryCode",
            "city",
            "state",
            "address",
            "birthDate",
            "anniversaryDate",
        ] as const;

        const data = this.buildUpdatedData(existingContact, contact, updatableFields);
    
        if (Object.keys(data).length > 0) {
            const updated = await this.prisma.contact.update({
                where: { id: existingContact.id },
                data, 
            });
        }
        await this.addImportContactQueueLog(user, contact, contactImportQueue, ContactImportQueueLogStatus.UPDATED);
    }

    private buildUpdatedData<T extends Record<string, any>>(existing: T, incoming: any, fields: readonly (keyof T)[] ): Partial<T> & {
        birthYear?: number;
        birthMonth?: number;
        birthDay?: number;
        anniversaryYear?: number;
        anniversaryMonth?: number;
        anniversaryDay?: number;} {

        const data = {} as Partial<T> & {
            birthYear?: number;
            birthMonth?: number;
            birthDay?: number;
            anniversaryYear?: number;
            anniversaryMonth?: number;
            anniversaryDay?: number;
        };

        const parseDate = (value: any): Date | null => {
            if (!value) return null;

            if (value instanceof Date) return !isNaN(value.getTime()) ? value : null;

            let cleanValue = value;
            if (typeof value === 'string') {
                cleanValue = value.replace(/_+\d+$/, '').trim();
                const parsed = new Date(cleanValue);
                return !isNaN(parsed.getTime()) ? parsed : null;
            }
            return null;
        };

        const isEmpty = (val: any) =>  val === null || val === undefined || val === "" || val === 0;

        for (const field of fields) {
            const existingValue = existing[field];
            const newValue = incoming[field];

            const hasNewValue = !isEmpty(newValue);
            const hasExistingValue = !isEmpty(existingValue);
            const valuesDiffer = existingValue !== newValue;

            if (hasNewValue && (valuesDiffer || !hasExistingValue)) {
            let processedValue: any = newValue;
            if (field === "birthDate" || field === "anniversaryDate") {
                console.log(`field.........${field.toString}`);
                console.log(`field.........${newValue}`);
                const date = parseDate(newValue);
                console.log(`date.........${date}`);
                if (date) {
                processedValue = date;
                data[field === "birthDate" ? "birthYear" : "anniversaryYear"] = date.getFullYear();
                data[field === "birthDate" ? "birthMonth" : "anniversaryMonth"] = date.getMonth() + 1;
                data[field === "birthDate" ? "birthDay" : "anniversaryDay"] = date.getDate();
                } else {
                    continue;
                }
            }
             (data as any)[field] = processedValue;
        }
    }
    return data;
  }


  async addImportContactQueueLog(user:BasicUser, transformedContact: any, contactImportQueue: ContactImportQueue, contactImportQueueLogStatus: ContactImportQueueLogStatus) {
            // Build contact object

            const birthDate = this.parseDateString(transformedContact.birthDate);
            const anniversaryDate = this.parseDateString(transformedContact.anniversaryDate);

            const contactImportQueueLog: ContactImportQueueLog = {
                userId: user.parentUserId ?? user.id,
                createdBy: user.id,
                agencyId: user.agencyId,
                contactId: transformedContact.id ?? null,
                contactImportQueueId: contactImportQueue.id,
                number: transformedContact.number,
                firstName: transformedContact.firstName || null,
                lastName: transformedContact.lastName || null,
                email: transformedContact.email || null,
                city: transformedContact.city || null,
                state: transformedContact.state || null,
                country: contactImportQueue.country || 'US',
                countryCode: contactImportQueue.countryCode || '1',
                address: transformedContact.address || null,
                status: contactImportQueueLogStatus,
                birthDate: birthDate || null,
                anniversaryDate: anniversaryDate || null,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as ContactImportQueueLog;

        const insertedContact = await this.prisma.contactImportQueueLog.create({
            data: contactImportQueueLog
        });
        return insertedContact ? insertedContact.id : null;
    }
}
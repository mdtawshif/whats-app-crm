import { IsNumber, IsEnum, IsObject, IsOptional } from 'class-validator';
import { EventKeys } from '../../../../src/types/triggers';



/**
 * DTO for creating a trigger event queue entry.
 */
export class CreateTriggerEventQueueDto {
    /**
     * The ID of the agency.
     */
    @IsNumber({}, { message: 'agencyId must be a bigint' })
    agencyId: bigint;

    /**
     * The ID of the user (or parent user).
     */
    @IsNumber({}, { message: 'userId must be a bigint' })
    userId: bigint;

    /**
     * The ID of the contact.
     */
    @IsNumber({}, { message: 'contactId must be a bigint' })
    contactId: bigint;

    /**
     * The event key for the trigger (e.g., CONTACT_ADDED).
     */
    @IsEnum(EventKeys, { message: 'eventKey must be a valid EventKeys value' })
    eventKey: EventKeys;

    /**
     * Optional additional payload data.
     */
    @IsObject({ message: 'payload must be an object' })
    @IsOptional()
    payload?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
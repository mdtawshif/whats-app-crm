// src/modules/contacts/dto/index.ts (for easy imports)
export * from './create-contact.dto';
export * from './bulk-create-contact.dto';
export * from './upload-contacts.dto';
export * from './get-contacts.dto';
export * from './update-contact.dto';
export * from '../../custom-fields/dto/create-custom-field.dto';
export * from './create-segment.dto';

export enum NotificationSourceType {
    ERROR = "ERROR",
    SUCCESS = "SUCCESS"
}
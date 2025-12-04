import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString } from 'class-validator';
export class AssetDTO {

    //  Asset ID (optional for creation)
    @ApiProperty({
        description: 'Unique identifier of the asset',
        type: Number,
        required: false,
        example: 123,
    })
    @IsOptional()
    @IsNumber()
    private readonly id: bigint;

    //  Asset name
    @ApiProperty({
        description: 'Name of the asset',
        type: String,
        example: 'Contacts',
    })
    @IsString()
    private readonly name: string;

    private constructor(id: bigint, name: string) {
        this.id = id;
        this.name = name;
    }

    //  1. Factory with name only
    public static ofName(name: string): AssetDTO {
        return new AssetDTO(0n, name);
    }

    //  2. Factory with id + name
    public static ofIdAndName(id: bigint, name: string): AssetDTO {
        return new AssetDTO(id, name);
    }

    //  3. General factory (alias)
    public static of(id: bigint, name: string): AssetDTO {
        return new AssetDTO(id, name);
    }

    public getId(): bigint {
        return this.id;
    }

    public getName(): string {
        return this.name;
    }

    public toString(): string {
        return `Assets{id=${this.id}, name='${this.name}'}`;
    }

    // Static constants
    public static CONTACTS = 'Contacts';
    public static MESSAGE_TEMPLATES = 'Message Templates';
    public static AGENCY_SETTINGS = 'Agency Settings';
    public static USER_SETTINGS = 'User Settings';
    public static WHATSAPP_PROFILES = 'WhatsApp Profiles';
    public static INBOX = 'Inbox';
    public static SEGMENTS = 'Segments';
    public static BROADCASTS = 'Broadcasts';
    public static INTEGRATIONS = 'Integrations';
    public static BILLING = 'Billing';
    public static TEAMS = 'Teams';
    public static TAGS = 'Tags';
    public static REPORTS = 'Reports';
    public static PAYMENTS = 'Payments';
    public static PERSONALIZATIONS = 'Personalizations';

}
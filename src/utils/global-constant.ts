import { Filter } from "src/types/triggers";
import { AssetDTO } from "./AssetDTO";
import { getTimeOptions } from "./dateUtils";
import { PermissionDTO } from "./PermissionDTO";
import { RoleDTO } from "./RoleDTO";

export const ROLES = [
    { name: RoleDTO.SUPER_ADMIN_ROLE_NAME },
    { name: RoleDTO.ADMIN_ROLE_NAME },
    { name: RoleDTO.TEAM_LEADER_ROLE_NAME },
    { name: RoleDTO.MEMBER_ROLE_NAME },
];

export const DEFAULT_AGENCY_NAME = "WAgend Agency";
export const DEFAULT_AGENCY_DOMAIN = "http://orangetoolz.com/";
export const PACKAGE_NAME_BASIC = "BASIC";
export const PACKAGE_NAME_PRO = "PRO";
export const CONTACT_SOURCE_MANUAL = "MANUAL";
export const CONTACT_SOURCE_CSV = "CSV";
export const CONTACT_SOURCE_GOOGLE_SHEET = "GOOGLE_SHEET";
export const CONTACT_SOURCE_GOOGLE_CONTACTS = "GOOGLE_CONTACTS";

export const PERMISSIONS = [
    { name: PermissionDTO.CREATE_PERMISSION_NAME, value: PermissionDTO.CREATE_PERMISSION_VALUE },
    { name: PermissionDTO.EDIT_PERMISSION_NAME, value: PermissionDTO.EDIT_PERMISSION_VALUE },
    { name: PermissionDTO.VIEW_PERMISSION_NAME, value: PermissionDTO.VIEW_PERMISSION_VALUE },
    { name: PermissionDTO.DELETE_PERMISSION_NAME, value: PermissionDTO.DELETE_PERMISSION_VALUE },
    { name: PermissionDTO.EXPORT_PERMISSION_NAME, value: PermissionDTO.EXPORT_PERMISSION_VALUE },
];

export const CONTACT_SOURCES = [
    { name: CONTACT_SOURCE_MANUAL, description: 'Manual entry of contacts' },
    { name: CONTACT_SOURCE_CSV, description: 'Imported via CSV file' },
    { name: CONTACT_SOURCE_GOOGLE_SHEET, description: 'Imported from Google Sheet' },
    { name: CONTACT_SOURCE_GOOGLE_CONTACTS, description: 'Imported from Google Contacts' },
];


export const ASSETS = [
    { name: AssetDTO.CONTACTS },
    { name: AssetDTO.MESSAGE_TEMPLATES },
    { name: AssetDTO.AGENCY_SETTINGS },
    { name: AssetDTO.USER_SETTINGS },
    { name: AssetDTO.WHATSAPP_PROFILES },
    { name: AssetDTO.INBOX },
    { name: AssetDTO.SEGMENTS },
    { name: AssetDTO.BROADCASTS },
    { name: AssetDTO.INTEGRATIONS },
    { name: AssetDTO.BILLING },
    { name: AssetDTO.TEAMS },
    { name: AssetDTO.TAGS },
    { name: AssetDTO.REPORTS },
    { name: AssetDTO.PAYMENTS },
    { name: AssetDTO.PERSONALIZATIONS },
];

export const DEFAULT_ROLE_PERMISSIONS = {
    [RoleDTO.ADMIN_ROLE_NAME]: new Map<AssetDTO, PermissionDTO[]>([
        [AssetDTO.of(0n, AssetDTO.CONTACTS), [
            PermissionDTO.of(0n, PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.DELETE_PERMISSION_NAME),
        ]],
        [AssetDTO.of(0n, AssetDTO.MESSAGE_TEMPLATES), [
            PermissionDTO.of(0n, PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.DELETE_PERMISSION_NAME),
        ]],
        [AssetDTO.of(0n, AssetDTO.AGENCY_SETTINGS), [
            PermissionDTO.of(0n, PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.DELETE_PERMISSION_NAME),
        ]],
        [AssetDTO.of(0n, AssetDTO.USER_SETTINGS), [
            PermissionDTO.of(0n, PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.DELETE_PERMISSION_NAME),
        ]],
        [AssetDTO.of(0n, AssetDTO.WHATSAPP_PROFILES), [
            PermissionDTO.of(0n, PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.DELETE_PERMISSION_NAME),
        ]],
        [AssetDTO.of(0n, AssetDTO.INBOX), [PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME)]],
        [AssetDTO.of(0n, AssetDTO.SEGMENTS), [
            PermissionDTO.of(0n, PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.DELETE_PERMISSION_NAME),
        ]],
        [AssetDTO.of(0n, AssetDTO.BROADCASTS), [
            PermissionDTO.of(0n, PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.DELETE_PERMISSION_NAME),
        ]],
        [AssetDTO.of(0n, AssetDTO.INTEGRATIONS), [
            PermissionDTO.of(0n, PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.DELETE_PERMISSION_NAME),
        ]],
        [AssetDTO.of(0n, AssetDTO.BILLING), [
            PermissionDTO.of(0n, PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.DELETE_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME),
        ]],
        [AssetDTO.of(0n, AssetDTO.TEAMS), [
            PermissionDTO.of(0n, PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.DELETE_PERMISSION_NAME),
        ]],
        [AssetDTO.of(0n, AssetDTO.TAGS), [
            PermissionDTO.of(0n, PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.DELETE_PERMISSION_NAME),
        ]],
        [AssetDTO.of(0n, AssetDTO.REPORTS), [PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME)]],
        [AssetDTO.ofName(AssetDTO.PAYMENTS), [
            PermissionDTO.ofName(PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.ofName(PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME),
            PermissionDTO.ofName(PermissionDTO.DELETE_PERMISSION_NAME),
        ]],
        [AssetDTO.ofName(AssetDTO.PERSONALIZATIONS), [
            PermissionDTO.ofName(PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.ofName(PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME),
            PermissionDTO.ofName(PermissionDTO.DELETE_PERMISSION_NAME),
        ]],
    ]),

    [RoleDTO.MEMBER_ROLE_NAME]: new Map<AssetDTO, PermissionDTO[]>([
        [AssetDTO.of(0n, AssetDTO.CONTACTS), [PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME)]],
        [AssetDTO.of(0n, AssetDTO.MESSAGE_TEMPLATES), [PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME)]],
        [AssetDTO.of(0n, AssetDTO.INBOX), [PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME)]],
        [AssetDTO.of(0n, AssetDTO.SEGMENTS), [PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME)]],
        [AssetDTO.of(0n, AssetDTO.TEAMS), [PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME)]],
        [AssetDTO.of(0n, AssetDTO.TAGS), [
            PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.DELETE_PERMISSION_NAME),
        ]],
        [AssetDTO.of(0n, AssetDTO.REPORTS), [PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME)]],
    ]),

    [RoleDTO.TEAM_LEADER_ROLE_NAME]: new Map<AssetDTO, PermissionDTO[]>([
        [AssetDTO.of(0n, AssetDTO.CONTACTS), [
            PermissionDTO.of(0n, PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME),
        ]],
        [AssetDTO.of(0n, AssetDTO.MESSAGE_TEMPLATES), [PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME)]],
        [AssetDTO.of(0n, AssetDTO.INBOX), [PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME)]],
        [AssetDTO.of(0n, AssetDTO.SEGMENTS), [
            PermissionDTO.of(0n, PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.DELETE_PERMISSION_NAME),
        ]],
        [AssetDTO.of(0n, AssetDTO.BROADCASTS), [PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME)]],
        [AssetDTO.of(0n, AssetDTO.TEAMS), [PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME)]],
        [AssetDTO.of(0n, AssetDTO.TAGS), [
            PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.of(0n, PermissionDTO.DELETE_PERMISSION_NAME),
        ]],
        [AssetDTO.of(0n, AssetDTO.REPORTS), [PermissionDTO.of(0n, PermissionDTO.VIEW_PERMISSION_NAME)]],
        [AssetDTO.ofName(AssetDTO.PAYMENTS), [
            PermissionDTO.ofName(PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.ofName(PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME),
            PermissionDTO.ofName(PermissionDTO.DELETE_PERMISSION_NAME),
        ]],
        [AssetDTO.ofName(AssetDTO.PERSONALIZATIONS), [
            PermissionDTO.ofName(PermissionDTO.CREATE_PERMISSION_NAME),
            PermissionDTO.ofName(PermissionDTO.EDIT_PERMISSION_NAME),
            PermissionDTO.ofName(PermissionDTO.VIEW_PERMISSION_NAME),
        ]],
    ]),
};


export const VALID_CUSTOM_FIELD_TYPES = [
    'TEXT',
    'NUMBER',
    'DATE',
    'BOOLEAN',
    'SELECT',
] as const;

export type CustomFieldType = typeof VALID_CUSTOM_FIELD_TYPES[number];





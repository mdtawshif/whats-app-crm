-- CreateTable
CREATE TABLE `agencies` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `owner_id` BIGINT UNSIGNED NULL,
    `name` VARCHAR(255) NOT NULL,
    `status` ENUM('ACTIVE', 'DELETED', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `domain` VARCHAR(255) NULL,
    `domain_prefix` VARCHAR(255) NULL,
    `logo_url` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_agencies_name`(`name`),
    INDEX `idx_agencies_status`(`status`),
    INDEX `idx_agencies_name_status`(`name`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assets` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NULL,
    `name` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_agency_assets_name`(`agency_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact_sources` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `contact_sources_agency_id_name_key`(`agency_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_packages` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'DELETED', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `cycle_period` ENUM('HALF_YEAR', 'LIFE_TIME', 'MONTH', 'YEAR') NOT NULL,
    `charge_amount` DECIMAL(12, 2) NOT NULL,
    `trial_free_credit` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `billing_packages_agency_id_name_status_key`(`agency_id`, `name`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `permission_id` BIGINT UNSIGNED NOT NULL,
    `permission_name` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `permissions_agency_id_permission_name_key`(`agency_id`, `permission_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NULL,
    `name` VARCHAR(191) NOT NULL,
    `permission_mask` VARCHAR(100) NOT NULL DEFAULT '0',
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `roles_name_key`(`name`),
    UNIQUE INDEX `agency_name_status_unique`(`agency_id`, `name`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NULL,
    `parent_user_id` BIGINT UNSIGNED NULL,
    `role_id` BIGINT UNSIGNED NULL,
    `user_name` VARCHAR(190) NULL,
    `api_key` VARCHAR(190) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `password` VARCHAR(255) NOT NULL,
    `raw_password` VARCHAR(191) NULL,
    `current_credit` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `autoRecharge` ENUM('YES', 'NO') NOT NULL DEFAULT 'NO',
    `auto_recharge_amount` DOUBLE NOT NULL DEFAULT 25.00,
    `minimum_credit_threshhold` BIGINT NULL DEFAULT 10,
    `time_zone` VARCHAR(100) NOT NULL DEFAULT 'America/New_York',
    `role_permission_mask` VARCHAR(100) NOT NULL DEFAULT '0',
    `added_permission_mask` VARCHAR(100) NOT NULL DEFAULT '0',
    `removed_permission_mask` VARCHAR(100) NOT NULL DEFAULT '0',
    `is_mail_verified` ENUM('NO', 'YES') NOT NULL DEFAULT 'NO',
    `status` ENUM('ACTIVE', 'CANCEL_SUB_REQUESTED', 'DEACTIVATE_ACC_REQUESTED', 'DELETED', 'INACTIVE', 'NEED_TO_RESET_CREDENTIAL', 'PENDING') NOT NULL DEFAULT 'ACTIVE',
    `profile_url` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_agency_email_key`(`agency_id`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_packages` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `package_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('ACTIVE', 'DELETED', 'INACTIVE', 'TRIALING') NOT NULL DEFAULT 'ACTIVE',
    `start_date` DATETIME(3) NOT NULL,
    `next_billing_date` DATETIME(3) NOT NULL,
    `trial_mode` ENUM('NO', 'YES') NOT NULL DEFAULT 'NO',
    `message` VARCHAR(255) NULL,
    `provider_subscription_id` VARCHAR(191) NULL,
    `trial_start` DATETIME(3) NULL,
    `trial_end` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_packages_user_id_package_id_status_key`(`user_id`, `package_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teams` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `owner_id` BIGINT UNSIGNED NULL,
    `status` ENUM('ACTIVE', 'DELETED', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `team_members` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `team_id` BIGINT UNSIGNED NOT NULL,
    `member_id` BIGINT UNSIGNED NOT NULL,
    `team_role` ENUM('LEADER', 'MEMBER', 'OWNER') NOT NULL DEFAULT 'MEMBER',
    `status` ENUM('ACTIVE', 'DELETED', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact_import_queues` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `file_type` ENUM('CSV', 'GOOGLE_SHEET') NOT NULL,
    `file_url` TEXT NULL,
    `file_name` VARCHAR(191) NULL,
    `file_summary` JSON NULL,
    `field_mapping` TEXT NULL,
    `status` ENUM('COMPLETED', 'FAILED', 'PENDING', 'PROCESSING', 'QUEUED') NOT NULL DEFAULT 'PENDING',
    `country` VARCHAR(190) NULL,
    `country_code` VARCHAR(190) NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_contact_import_agency_user_createdby`(`agency_id`, `user_id`, `created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contacts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `number` VARCHAR(20) NOT NULL,
    `first_name` VARCHAR(100) NULL,
    `last_name` VARCHAR(100) NULL,
    `email` VARCHAR(255) NULL,
    `city` VARCHAR(190) NULL,
    `state` VARCHAR(190) NULL,
    `country` VARCHAR(190) NULL,
    `country_code` VARCHAR(190) NULL,
    `address` TEXT NULL,
    `status` ENUM('ACTIVE', 'DELETED', 'INACTIVE', 'OPT_OUT') NULL,
    `number_status` ENUM('BLOCKED', 'INVALID', 'PENDING_VERIFICATION', 'VERIFIED', 'WHATSAPP_READY') NULL,
    `birth_date` DATE NULL,
    `anniversary_date` DATE NULL,
    `source_id` BIGINT UNSIGNED NULL,
    `google_contact_id` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `birth_year` INTEGER UNSIGNED NULL,
    `birth_month` TINYINT UNSIGNED NULL,
    `birth_day` TINYINT UNSIGNED NULL,
    `anniversary_year` INTEGER UNSIGNED NULL,
    `anniversary_month` TINYINT UNSIGNED NULL,
    `anniversary_day` TINYINT UNSIGNED NULL,

    INDEX `contacts_birth_month_birth_day_idx`(`birth_month`, `birth_day`),
    INDEX `contacts_anniversary_month_anniversary_day_idx`(`anniversary_month`, `anniversary_day`),
    INDEX `contacts_birth_year_idx`(`birth_year`),
    INDEX `contacts_anniversary_year_idx`(`anniversary_year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact_import_queue_contacts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `queue_id` BIGINT UNSIGNED NOT NULL,
    `contact_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_queue_contact`(`queue_id`, `contact_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `personalizations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `value` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_personalizations_agency_user_createdby`(`agency_id`, `user_id`, `created_by`),
    UNIQUE INDEX `personalizations_user_key_unique`(`user_id`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `custom_fields` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `default_value` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_custom_fields_agency_user_createdby`(`agency_id`, `user_id`, `created_by`),
    UNIQUE INDEX `custom_fields_user_label_key`(`user_id`, `label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact_custom_fields` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `contact_id` BIGINT UNSIGNED NOT NULL,
    `custom_field_id` BIGINT UNSIGNED NOT NULL,
    `value` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_contact_custom_fields_agency_user_createdby`(`agency_id`, `user_id`, `created_by`),
    UNIQUE INDEX `uniq_contact_field`(`contact_id`, `custom_field_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `send_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `from` VARCHAR(255) NULL,
    `to` VARCHAR(255) NULL,
    `payload` TEXT NULL,
    `type` ENUM('CALL', 'EMAIL', 'SMS') NOT NULL DEFAULT 'EMAIL',
    `provider_name` VARCHAR(100) NULL,
    `status` ENUM('COMPLETED', 'FAILED', 'NEW') NOT NULL DEFAULT 'NEW',
    `sent_at` DATETIME(3) NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_send_logs_agency_user_createdby`(`agency_id`, `user_id`, `created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meta_oauth_tokens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `access_token` TEXT NULL,
    `token_type` TEXT NULL,
    `profile_data` TEXT NULL,
    `product_type` ENUM('INSTAGRAM', 'MESSENGER', 'WHATS_APP') NOT NULL DEFAULT 'WHATS_APP',
    `expired_at` DATETIME(3) NULL,
    `is_revoked` BOOLEAN NOT NULL DEFAULT false,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `phone_number_id` VARCHAR(100) NULL,
    `waba_id` VARCHAR(100) NULL,
    `business_id` VARCHAR(100) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `segments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `filters` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_segments_agency_user_createdby`(`agency_id`, `user_id`, `created_by`),
    UNIQUE INDEX `segments_user_id_name_key`(`user_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `segment_contacts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `segment_id` BIGINT UNSIGNED NOT NULL,
    `contact_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_segment_contacts_agency_user_createdby`(`agency_id`, `user_id`, `created_by`),
    UNIQUE INDEX `segment_contacts_segment_id_contact_id_key`(`segment_id`, `contact_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sso_providers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NULL,
    `agency_id` BIGINT UNSIGNED NULL,
    `provider_name` VARCHAR(100) NULL,
    `provider_type` ENUM('FACEBOOK', 'GOOGLE') NOT NULL DEFAULT 'GOOGLE',
    `client_id` VARCHAR(255) NULL,
    `client_secret` VARCHAR(255) NULL,
    `redirect_url` VARCHAR(255) NULL,
    `provider_info` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_templates` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `message_id` VARCHAR(191) NULL,
    `waba_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(512) NOT NULL,
    `category` ENUM('AUTHENTICATION', 'MARKETING', 'UTILITY') NOT NULL,
    `language` VARCHAR(10) NOT NULL,
    `components` JSON NULL,
    `status` ENUM('APPROVED', 'PENDING', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_message_templates_agency_user_createdby`(`agency_id`, `user_id`, `created_by`),
    INDEX `idx_message_templates_message_id`(`message_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_template_summaries` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `message_template_id` BIGINT UNSIGNED NOT NULL,
    `totalSent` INTEGER NOT NULL DEFAULT 0,
    `totalRead` INTEGER NOT NULL DEFAULT 0,
    `delivered` INTEGER NOT NULL DEFAULT 0,
    `undelivered` INTEGER NOT NULL DEFAULT 0,
    `queued` INTEGER NOT NULL DEFAULT 0,
    `failed` INTEGER NOT NULL DEFAULT 0,
    `totalBroadcast` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `message_template_summaries_message_template_id_key`(`message_template_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activities` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `category` ENUM('CONTACT', 'TAG', 'SEGMENT', 'TRIGGER', 'BROADCAST', 'MESSAGE_TEMPLATE', 'CONTACT_FILE', 'GOOGLE_SHEET', 'GOOGLE_CONTACT', 'CUSTOM_FIELD', 'WA_BUSINESS_NUMBER', 'WA_BUSINESS_ACCOUNT', 'FB_BUSINESS_ACCOUNT', 'USER_SETTING', 'PERSONALIZATION', 'TEAM', 'USER', 'SYSTEM', 'WHATSAPP') NOT NULL,
    `action` ENUM('CREATE', 'UPDATE', 'DELETE', 'ASSIGN', 'REMOVE', 'EXECUTE', 'SEND', 'RECEIVE', 'PAUSE', 'RESUME', 'UNSUBSCRIBE', 'OPTOUT', 'APPROVE', 'REJECT', 'UPLOAD', 'PROCESS', 'IMPORT', 'SYNC', 'RESET', 'APPLY', 'LOGIN', 'LOGOUT', 'DELIVERED', 'READ', 'FAILED', 'ERROR') NOT NULL,
    `description` TEXT NULL,
    `meta` JSON NULL,
    `contact_id` BIGINT UNSIGNED NULL,
    `tag_id` BIGINT UNSIGNED NULL,
    `segment_id` BIGINT UNSIGNED NULL,
    `trigger_id` BIGINT UNSIGNED NULL,
    `broadcast_id` BIGINT UNSIGNED NULL,
    `message_template_id` BIGINT UNSIGNED NULL,
    `custom_field_id` BIGINT UNSIGNED NULL,
    `wa_business_number_id` BIGINT UNSIGNED NULL,
    `wa_business_account_id` BIGINT UNSIGNED NULL,
    `fb_business_account_id` BIGINT UNSIGNED NULL,
    `user_setting_id` BIGINT UNSIGNED NULL,
    `personalization_id` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activities_category_action_idx`(`category`, `action`),
    INDEX `activities_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tokens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `token` TEXT NULL,
    `expires` DATETIME(3) NULL,
    `blacklisted` BOOLEAN NULL,
    `type` VARCHAR(111) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fb_business_accounts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `business_id` VARCHAR(190) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_fb_business_accounts_agency_user`(`agency_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_business_accounts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `fb_business_id` BIGINT UNSIGNED NOT NULL,
    `wabaId` VARCHAR(190) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `is_app_subscribed` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `wa_business_accounts_wabaId_key`(`wabaId`),
    INDEX `idx_wa_business_accounts_agency_user`(`agency_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_business_numbers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `phone_number_id` VARCHAR(190) NOT NULL,
    `wa_business_account_id` BIGINT UNSIGNED NOT NULL,
    `verified_name` VARCHAR(255) NULL,
    `display_phone_number` VARCHAR(20) NULL,
    `country_code` VARCHAR(10) NULL,
    `number` VARCHAR(20) NULL,
    `quality_rating` ENUM('GREEN', 'RED', 'UNKNOWN', 'YELLOW') NOT NULL DEFAULT 'UNKNOWN',
    `code_verification_status` ENUM('EXPIRED', 'NOT_VERIFIED', 'VERIFIED') NOT NULL DEFAULT 'NOT_VERIFIED',
    `number_status` ENUM('ACTIVE', 'INACTIVE', 'NOT_VERIFIED', 'PENDING', 'VERIFIED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `pin_code` VARCHAR(6) NOT NULL DEFAULT '000000',
    `is_register` BOOLEAN NOT NULL DEFAULT false,
    `meta_oauth_token_id` BIGINT UNSIGNED NULL,

    INDEX `idx_wa_business_numbers_agency_user`(`agency_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_business_profiles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `waba_id` VARCHAR(190) NULL,
    `about` TEXT NULL,
    `address` TEXT NULL,
    `country` VARCHAR(190) NULL,
    `state` VARCHAR(190) NULL,
    `city` VARCHAR(255) NULL,
    `description` LONGTEXT NULL,
    `email` VARCHAR(255) NULL,
    `profile_url` TEXT NULL,
    `business_category` ENUM('EDUCATION', 'FINANCE', 'HEALTHCARE', 'HOSPITALITY', 'OTHER', 'RETAIL', 'TECHNOLOGY') NOT NULL DEFAULT 'OTHER',
    `website_url` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_wa_business_profiles_agency_user`(`agency_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agency_settings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `setting_key` VARCHAR(190) NOT NULL,
    `value` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_settings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `setting_key` VARCHAR(190) NOT NULL,
    `value` TEXT NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_transactions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `type` ENUM('IN', 'OUT') NOT NULL,
    `credit_amount` DOUBLE NOT NULL,
    `transaction_for` VARCHAR(190) NOT NULL,
    `billing_package_id` BIGINT UNSIGNED NOT NULL,
    `note` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `contact_id` BIGINT UNSIGNED NULL,
    `conversation_id` BIGINT UNSIGNED NULL,
    `broadcast_id` BIGINT UNSIGNED NULL,
    `broadcast_setting_id` BIGINT UNSIGNED NULL,
    `messaging_pricing_id` BIGINT UNSIGNED NULL,

    INDEX `idx_billing_transactions_agency_user_createdBy`(`agency_id`, `user_id`, `created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inbox_threads` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `contact_id` BIGINT UNSIGNED NOT NULL,
    `content_type` VARCHAR(191) NOT NULL,
    `in_out` ENUM('IN', 'OUT') NOT NULL,
    `is_read` ENUM('READ', 'UNREAD') NOT NULL,
    `message_content` LONGTEXT NULL,
    `media_url` LONGTEXT NULL,
    `from` VARCHAR(191) NULL,
    `to` VARCHAR(191) NULL,
    `status` ENUM('FAILED', 'SUCCESS') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_communication` DATETIME(3) NULL,

    INDEX `idx_inbox_threads_agency_user_createdBy`(`agency_id`, `user_id`, `created_by`),
    UNIQUE INDEX `uniq_inbox_threads_user_contact`(`user_id`, `contact_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `contact_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `broadcast_id` BIGINT UNSIGNED NULL,
    `waba_id` VARCHAR(190) NULL,
    `waba_name` VARCHAR(190) NULL,
    `business_id` VARCHAR(190) NULL,
    `business_name` VARCHAR(190) NULL,
    `from_number` VARCHAR(20) NULL,
    `to_number` VARCHAR(20) NULL,
    `phone_number_id` VARCHAR(190) NOT NULL,
    `in_out` ENUM('IN', 'OUT') NULL,
    `message` LONGTEXT NULL,
    `error_message` TEXT NULL,
    `message_id` VARCHAR(190) NULL,
    `message_type` ENUM('TEMPLATE', 'TEXT') NULL,
    `messaging_product` ENUM('INSTAGRAM', 'MESSENGER', 'WHATS_APP') NULL,
    `response` JSON NULL,
    `status` ENUM('DELIVERED', 'FAILED', 'READ', 'RECEIVED', 'SENT', 'UNDELIVERED') NOT NULL DEFAULT 'SENT',
    `is_read` ENUM('READ', 'UNREAD') NOT NULL DEFAULT 'UNREAD',
    `last_message_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `account_sid` VARCHAR(255) NULL,
    `message_sid` VARCHAR(255) NULL,

    INDEX `idx_conversations_agency_user_createdBy`(`agency_id`, `user_id`, `created_by`),
    INDEX `idx_conversations_agency_user_contact`(`agency_id`, `user_id`, `contact_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broadcasts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `title` VARCHAR(512) NOT NULL,
    `status` ENUM('ACTIVE', 'COMPLETED', 'DELETED', 'FAILED', 'INACTIVE', 'PAUSED', 'PAUSED_FOR_CREDIT', 'RUNNING', 'STOP') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NULL,
    `started_at` DATETIME(3) NULL,
    `paused_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NULL,
    `error_message` VARCHAR(255) NULL,
    `waba_id` VARCHAR(255) NULL,
    `total_contacted` INTEGER NOT NULL DEFAULT 0,
    `reschedule_due_to_rate_limit` BOOLEAN NOT NULL DEFAULT false,
    `from_date` DATETIME(3) NOT NULL,
    `to_date` DATETIME(3) NOT NULL,
    `selected_days` JSON NOT NULL,
    `time_zone` VARCHAR(100) NOT NULL DEFAULT 'America/New_York',
    `start_time` TIME(0) NOT NULL,
    `end_time` TIME(0) NOT NULL,
    `live_mode` ENUM('NO', 'YES') NOT NULL DEFAULT 'NO',

    INDEX `idx_broadcasts_agency_user_createdBy`(`agency_id`, `user_id`, `created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broadcast_summaries` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `broadcast_id` BIGINT UNSIGNED NOT NULL,
    `total_contact` INTEGER NOT NULL DEFAULT 0,
    `total_connected` INTEGER NOT NULL DEFAULT 0,
    `total_paused` INTEGER NOT NULL DEFAULT 0,
    `total_unsubscribed` INTEGER NOT NULL DEFAULT 0,
    `total_optout` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `broadcast_summaries_broadcast_id_key`(`broadcast_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broadcast_settings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `broadcast_id` BIGINT UNSIGNED NOT NULL,
    `message_template_id` BIGINT UNSIGNED NULL,
    `message_body` LONGTEXT NULL,
    `rate_limit_enabled` ENUM('FALSE', 'TRUE') NULL,
    `limit_type` ENUM('PER_HOUR', 'PER_MINUTE', 'PER_MONTH') NOT NULL,
    `status` ENUM('ACTIVE', 'DELETED', 'INACTIVE') NOT NULL,
    `broadcast_type` ENUM('IMMEDIATE', 'RECURRING', 'SCHEDULE') NOT NULL,
    `limit_value` INTEGER NULL,
    `day` INTEGER NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `time` TIME NOT NULL,
    `retry_count` INTEGER NOT NULL DEFAULT 3,
    `retry_delay_seconds` INTEGER NOT NULL DEFAULT 60,
    `pause_on_error` ENUM('NO', 'YES') NOT NULL,
    `stop_on_limit_exceeded` ENUM('NO', 'YES') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `wa_business_number_id` BIGINT UNSIGNED NULL,

    INDEX `uq_user_broadcast_priority`(`user_id`, `broadcast_id`, `priority`),
    INDEX `idx_broadcast_sort`(`broadcast_id`, `broadcast_type`, `day`, `time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broadcast_message_queues` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `contact_id` BIGINT UNSIGNED NOT NULL,
    `broadcast_id` BIGINT UNSIGNED NOT NULL,
    `broadcast_setting_id` BIGINT UNSIGNED NOT NULL,
    `wa_business_number_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('DELIVERED', 'FAILED', 'PENDING', 'PROCESSING', 'SENT') NOT NULL,
    `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `failed_reason` LONGTEXT NULL,
    `response` JSON NULL,
    `message_type` ENUM('TEMPLATE', 'TEXT') NULL,
    `messaging_product` ENUM('INSTAGRAM', 'MESSENGER', 'WHATS_APP') NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_bmq_broadcast_setting_contact`(`broadcast_id`, `broadcast_setting_id`, `contact_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broadcast_message_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `contact_id` BIGINT UNSIGNED NOT NULL,
    `broadcast_id` BIGINT UNSIGNED NULL,
    `broadcast_setting_id` BIGINT UNSIGNED NULL,
    `wa_business_account_id` BIGINT UNSIGNED NULL,
    `fb_business_id` BIGINT UNSIGNED NULL,
    `wa_business_number_id` BIGINT UNSIGNED NULL,
    `message` LONGTEXT NULL,
    `messaging_product` ENUM('INSTAGRAM', 'MESSENGER', 'WHATS_APP') NULL,
    `message_type` ENUM('TEMPLATE', 'TEXT') NULL,
    `response` JSON NULL,
    `error_message` VARCHAR(190) NULL,
    `status` ENUM('DELIVERED', 'FAILED', 'READ', 'SENT', 'UNDELIVERED') NOT NULL DEFAULT 'SENT',
    `last_message_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `account_sid` VARCHAR(255) NULL,
    `message_sid` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `integrations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `type` ENUM('GOOGLE_CONTACT', 'GOOGLE_SHEETS', 'META_BUSINESS', 'OTHER', 'SHOPIFY', 'SLACK', 'TWILIO', 'ZAPIER') NOT NULL,
    `name` VARCHAR(191) NULL,
    `access_token` TEXT NULL,
    `refresh_token` TEXT NULL,
    `expires_at` DATETIME(3) NULL,
    `account_email` VARCHAR(255) NULL,
    `config` JSON NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_used_at` DATETIME(3) NULL,

    INDEX `integrations_type_idx`(`type`),
    INDEX `integrations_account_email_idx`(`account_email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_card_infos` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `card_number` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NULL,
    `token` VARCHAR(191) NULL,
    `card_brand` VARCHAR(50) NULL,
    `card_exp_month` INTEGER NULL,
    `card_exp_year` INTEGER NULL,
    `status` ENUM('ACTIVE', 'DELETED', 'INACTIVE', 'TRIALING') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stripe_webhook_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NULL,
    `agency_id` BIGINT UNSIGNED NULL,
    `json` JSON NOT NULL,
    `error_msg` TEXT NULL,
    `status` ENUM('INVALID', 'PROCESSED', 'PROCESSING', 'QUEUE') NOT NULL,
    `stripe_sigature` VARCHAR(191) NOT NULL,
    `stripe_event_type` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_packages_histories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_package_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `package_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('ACTIVE', 'DELETED', 'INACTIVE', 'TRIALING') NOT NULL,
    `start_date` DATETIME(3) NOT NULL,
    `next_billing_date` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_package_renew_histories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `card_info_id` BIGINT UNSIGNED NULL,
    `package_id` BIGINT UNSIGNED NOT NULL,
    `charge_amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('FAILED', 'PENDING', 'SUCCESS') NOT NULL DEFAULT 'SUCCESS',
    `fail_reason` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tags` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_tags_agency_user_createdBy`(`agency_id`, `user_id`, `created_by`),
    UNIQUE INDEX `tags_user_id_title_key`(`user_id`, `title`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact_tags` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `contact_id` BIGINT UNSIGNED NOT NULL,
    `tag_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_contact_tags_agency_user_createdBy`(`agency_id`, `user_id`, `created_by`),
    UNIQUE INDEX `contact_tags_contact_id_tag_id_key`(`contact_id`, `tag_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact_assignments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `contact_id` BIGINT UNSIGNED NOT NULL,
    `assigned_by` BIGINT UNSIGNED NULL,
    `assigned_to` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_tags_agency_user_assignedTo`(`agency_id`, `user_id`, `assigned_to`),
    UNIQUE INDEX `contact_assignments_assigned_to_contact_id_key`(`assigned_to`, `contact_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_notification_tokens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `type` ENUM('APNS', 'FCM') NOT NULL DEFAULT 'FCM',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `type` ENUM('AGENCY_ALERT', 'CONTACT_IMPORT_ALERT', 'ERROR', 'INFO', 'NEW_MESSAGE', 'SUCCESS', 'TEAM_UPDATE', 'TRIGGER_ALERT') NOT NULL,
    `title` VARCHAR(191) NULL,
    `message` VARCHAR(191) NOT NULL,
    `data` JSON NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,
    `navigatePath` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_notifications_agency_user_createdBy`(`agency_id`, `user_id`, `created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cron_jobs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `job_id` VARCHAR(191) NOT NULL,
    `status` ENUM('INVALID', 'PROCESSING', 'PROCESSED', 'QUEUE') NOT NULL,
    `last_processed_at` DATETIME(3) NOT NULL,
    `next_process_at` DATETIME(3) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `pattern` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `cron_jobs_job_id_key`(`job_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_auto_recharge_histories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `card_info_id` BIGINT UNSIGNED NULL,
    `package_id` BIGINT UNSIGNED NULL,
    `charge_amount` BIGINT NULL,
    `status` ENUM('FAILED', 'PENDING', 'SUCCESS') NOT NULL DEFAULT 'SUCCESS',
    `fail_reason` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meta_data_sync_jobs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `type` ENUM('ACCOUNT', 'TEMPLATE') NOT NULL DEFAULT 'ACCOUNT',
    `status` ENUM('COMPLETED', 'FAILED', 'IN_PROGRESS', 'PENDING') NOT NULL DEFAULT 'PENDING',
    `try_attempt` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `fail_message` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `meta_oauth_token_id` BIGINT UNSIGNED NULL,

    INDEX `idx_meta_data_sync_jobs_user`(`user_id`),
    INDEX `idx_meta_data_sync_jobs_oauth_token`(`meta_oauth_token_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_requests` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `type` ENUM('CANCEL_SUBSCRIPTION', 'CHANGE_PACKAGE_PLAN', 'DEACTIVATE_USER', 'IMPORT_GOOGLE_CONTACTS') NOT NULL DEFAULT 'CANCEL_SUBSCRIPTION',
    `request_at` DATETIME(3) NOT NULL,
    `schedule_at` DATETIME(3) NULL,
    `requestBody` JSON NULL,
    `status` ENUM('ACTIVE', 'DELETED', 'FAILED', 'INVALID', 'PROCESSED', 'PROCESSING', 'QUEUE') NOT NULL DEFAULT 'QUEUE',
    `message` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_user_requests_agency_user_createdby`(`agency_id`, `user_id`, `created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_request_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `user_request_id` BIGINT UNSIGNED NOT NULL,
    `type` ENUM('CANCEL_SUBSCRIPTION', 'CHANGE_PACKAGE_PLAN', 'DEACTIVATE_USER', 'IMPORT_GOOGLE_CONTACTS') NOT NULL DEFAULT 'CANCEL_SUBSCRIPTION',
    `request_data` JSON NULL,
    `message` VARCHAR(191) NULL,
    `status` ENUM('FAILED', 'INVALID', 'PROCESSING', 'QUEUE', 'SUCCESS') NOT NULL DEFAULT 'QUEUE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_user_request_logs_agency_user_request_status`(`agency_id`, `user_id`, `user_request_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `opt_out_contacts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `contact_id` BIGINT UNSIGNED NOT NULL,
    `reason` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `opt_out_contacts_agency_id_user_id_contact_id_key`(`agency_id`, `user_id`, `contact_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `triggers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` VARCHAR(1000) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'PAUSED') NOT NULL DEFAULT 'ACTIVE',
    `priority` INTEGER NOT NULL DEFAULT 0,
    `timezone` VARCHAR(50) NULL,
    `metadata` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `updated_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,
    `live_mode` ENUM('NO', 'YES') NOT NULL DEFAULT 'NO',

    INDEX `idx_triggers_agency_user_createdBy`(`agency_id`, `user_id`, `created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trigger_actions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` VARCHAR(1000) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `trigger_actions_key_key`(`key`),
    INDEX `idx_trigger_action_key`(`key`),
    INDEX `idx_trigger_action_title`(`title`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trigger_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` VARCHAR(1000) NULL,
    `metadata` JSON NULL,
    `allowedActions` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `trigger_events_key_key`(`key`),
    INDEX `idx_trigger_event_key`(`key`),
    INDEX `idx_trigger_event_title`(`title`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trigger_event_configs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `trigger_id` BIGINT UNSIGNED NOT NULL,
    `trigger_event_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `filters` JSON NULL,
    `configs` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_trigger_event_configs_agency_user_createdBy`(`agency_id`, `user_id`, `created_by`),
    UNIQUE INDEX `trigger_event_configs_trigger_id_trigger_event_id_key`(`trigger_id`, `trigger_event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trigger_action_configs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `trigger_id` BIGINT UNSIGNED NOT NULL,
    `trigger_event_id` BIGINT UNSIGNED NOT NULL,
    `trigger_event_config_id` BIGINT UNSIGNED NOT NULL,
    `action_id` BIGINT UNSIGNED NOT NULL,
    `configs` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_trigger_action_configs_agency_user_createdby`(`agency_id`, `user_id`, `created_by`),
    UNIQUE INDEX `trigger_action_configs_trigger_id_trigger_event_id_trigger_e_key`(`trigger_id`, `trigger_event_id`, `trigger_event_config_id`, `action_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trigger_event_execution_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `trigger_id` BIGINT UNSIGNED NOT NULL,
    `trigger_event_id` BIGINT UNSIGNED NOT NULL,
    `trigger_event_config_id` BIGINT UNSIGNED NOT NULL,
    `contact_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('FAILED', 'SUCCESS') NOT NULL DEFAULT 'FAILED',
    `error` VARCHAR(1000) NULL,
    `executed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_trigger_event_execution_logs_agency_user_trigger_event`(`agency_id`, `user_id`, `trigger_id`, `trigger_event_id`, `trigger_event_config_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trigger_event_action_execution_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `trigger_id` BIGINT UNSIGNED NOT NULL,
    `trigger_event_id` BIGINT UNSIGNED NOT NULL,
    `trigger_event_config_id` BIGINT UNSIGNED NOT NULL,
    `trigger_action_id` BIGINT UNSIGNED NOT NULL,
    `trigger_action_config_id` BIGINT UNSIGNED NOT NULL,
    `contact_id` BIGINT UNSIGNED NOT NULL,
    `error` VARCHAR(1000) NULL,
    `executed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('FAILED', 'SUCCESS') NOT NULL DEFAULT 'FAILED',

    INDEX `idx_agency_user_trigger_event_action`(`agency_id`, `user_id`, `trigger_id`, `trigger_event_id`, `trigger_event_config_id`, `trigger_action_id`, `trigger_action_config_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gmail_imported_contacts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `contact_id` BIGINT UNSIGNED NOT NULL,
    `gmail_account_id` BIGINT UNSIGNED NOT NULL,
    `gmail_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_gmail_imported_contacts_agency_user_gmailAccount_createdBy`(`agency_id`, `user_id`, `gmail_account_id`, `created_by`),
    UNIQUE INDEX `uq_gmail_contact_user`(`contact_id`, `gmail_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gmail_accounts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `access_token` TEXT NOT NULL,
    `refresh_token` TEXT NULL,
    `expires_at` DATETIME(3) NULL,
    `last_sync_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `gmail_accounts_email_key`(`email`),
    INDEX `idx_gmail_accounts_agency_user`(`agency_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broadcast_contact_entry_queues` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `broadcast_id` BIGINT UNSIGNED NOT NULL,
    `contact_id` BIGINT UNSIGNED NULL,
    `source_id` BIGINT UNSIGNED NULL,
    `contact_source` ENUM('CONTACT', 'FILE', 'GOOGLE_CONTACT', 'SEGMENT', 'TAG') NOT NULL DEFAULT 'CONTACT',
    `status` ENUM('COMPLETED', 'FAILED', 'PENDING', 'PROCESSING') NOT NULL DEFAULT 'PENDING',
    `failed_reason` VARCHAR(255) NULL,
    `requested_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,

    INDEX `idx_broadcast_contact_entry_status`(`status`),
    INDEX `idx_broadcast_contact_entry_agency_user_broadcast`(`agency_id`, `user_id`, `broadcast_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broadcast_contacts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `broadcast_id` BIGINT UNSIGNED NOT NULL,
    `contact_id` BIGINT UNSIGNED NOT NULL,
    `entry_date` DATETIME(3) NOT NULL,
    `contact_source` ENUM('BULK', 'FILE', 'SEGMENT', 'SINGLE', 'TAG') NOT NULL DEFAULT 'SINGLE',
    `status` ENUM('ACTIVE', 'OPT_OUT', 'PAUSED', 'RUNNING', 'UNSUBSCRIBE') NOT NULL,
    `last_message_at` DATETIME(3) NULL,
    `next_allowed_message_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_broadcast_contacts_agency_user_broadcast`(`agency_id`, `user_id`, `broadcast_id`),
    UNIQUE INDEX `broadcast_contacts_broadcast_id_contact_id_key`(`broadcast_id`, `contact_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broadcast_pause_resume_requests` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `broadcast_id` BIGINT UNSIGNED NOT NULL,
    `action` ENUM('PAUSE', 'PAUSED_FOR_CREDIT', 'RESUME') NOT NULL,
    `status` ENUM('COMPLETED', 'FAILED', 'PENDING', 'PROCESSING') NOT NULL,
    `failed_reason` VARCHAR(191) NULL,
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,

    INDEX `idx_broadcast_pause_resume_status`(`status`),
    INDEX `idx_broadcast_pause_resume_agency_user_broadcast`(`agency_id`, `user_id`, `broadcast_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact_pause_resume_requests` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `broadcast_id` BIGINT UNSIGNED NOT NULL,
    `contact_id` BIGINT UNSIGNED NOT NULL,
    `action` ENUM('OPT_OUT', 'PAUSE', 'RESUME', 'UNSUBSCRIBE') NOT NULL,
    `status` ENUM('COMPLETED', 'FAILED', 'PENDING', 'PROCESSING') NOT NULL,
    `failed_reason` VARCHAR(191) NOT NULL,
    `requested_at` DATETIME(3) NULL,
    `processed_at` DATETIME(3) NULL,

    INDEX `idx_contact_pause_resume_status`(`status`),
    INDEX `idx_contact_pause_resume_agency_user_broadcast`(`agency_id`, `user_id`, `broadcast_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_data_processes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NULL,
    `agency_id` BIGINT UNSIGNED NULL,
    `contact_id` BIGINT UNSIGNED NULL,
    `broadcast_id` BIGINT UNSIGNED NULL,
    `broadcast_setting_id` BIGINT UNSIGNED NULL,
    `raw_data` JSON NOT NULL,
    `status` ENUM('FAILED', 'PROCESSED', 'PROCESSING', 'QUEUE') NOT NULL DEFAULT 'QUEUE',
    `error_message` VARCHAR(1024) NULL,
    `gateway` ENUM('Other', 'PostMark', 'Stripe', 'Twilio', 'WhatsApp') NOT NULL DEFAULT 'Other',
    `direction` ENUM('DLR', 'INCOMING', 'Other', 'OUTGOING') NOT NULL DEFAULT 'Other',
    `account_sid` VARCHAR(255) NULL,
    `message_sid` VARCHAR(255) NULL,
    `from` VARCHAR(100) NULL,
    `to` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_status_direction`(`status`, `direction`),
    INDEX `idx_agency_user_account_contact`(`agency_id`, `user_id`, `account_sid`, `contact_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact_forward_queues` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `broadcast_id` BIGINT UNSIGNED NOT NULL,
    `contact_id` BIGINT UNSIGNED NOT NULL,
    `broadcast_setting_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('COMPLETED', 'FAILED', 'PENDING', 'PROCESSING') NOT NULL DEFAULT 'PENDING',
    `requested_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,
    `failed_reason` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messaging_pricings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `package_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NULL,
    `price` DOUBLE NOT NULL,
    `price_type` ENUM('PERCENTAGE', 'PRICE') NOT NULL,
    `message_type` ENUM('AUTHENTICATION', 'MARKETING', 'TEXT', 'UTILITY') NOT NULL,
    `in_out` ENUM('IN', 'OUT') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_messaging_pricings_package_message_user`(`package_id`, `message_type`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gateway_credentials` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NULL,
    `user_id` BIGINT UNSIGNED NULL,
    `setting_key` VARCHAR(191) NOT NULL,
    `setting_value` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'DELETED', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `gateway_type` ENUM('AWS_S3', 'POSTMARK', 'TWILIO') NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_gateway_credentials_type_agency_user`(`agency_id`, `gateway_type`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broadcast_settings_stats` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `broadcast_id` BIGINT UNSIGNED NOT NULL,
    `broadcast_setting_id` BIGINT UNSIGNED NOT NULL,
    `total_sent` INTEGER NOT NULL DEFAULT 0,
    `total_failed` INTEGER NOT NULL DEFAULT 0,
    `total_read` INTEGER NOT NULL DEFAULT 0,
    `total_delivered` INTEGER NOT NULL DEFAULT 0,
    `total_undelivered` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_user_broadcastSetting`(`user_id`, `broadcast_setting_id`),
    INDEX `idx_broadcastSetting`(`broadcast_setting_id`),
    UNIQUE INDEX `uq_broadcast_broadcastSetting`(`broadcast_id`, `broadcast_setting_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cache_trigger_event_queues` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `contact_id` BIGINT UNSIGNED NOT NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `trigger_event_type` VARCHAR(100) NOT NULL,
    `trigger_event_id` BIGINT UNSIGNED NOT NULL,
    `trigger_id` BIGINT UNSIGNED NULL,
    `trigger_event_config_id` BIGINT UNSIGNED NULL,
    `parent_cache_trigger_event_queue_id` BIGINT UNSIGNED NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `schedule_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fail_reason` VARCHAR(191) NULL DEFAULT '',
    `payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_event_agency_user_trigger_contact`(`agency_id`, `user_id`, `trigger_id`, `contact_id`),
    INDEX `idx_event_status_schedule`(`status`, `schedule_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cache_trigger_event_action_queues` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `contact_id` BIGINT UNSIGNED NOT NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `trigger_event_type` VARCHAR(100) NOT NULL,
    `trigger_event_id` BIGINT UNSIGNED NOT NULL,
    `trigger_id` BIGINT UNSIGNED NOT NULL,
    `trigger_event_config_id` BIGINT UNSIGNED NOT NULL,
    `trigger_action_type` VARCHAR(100) NOT NULL,
    `trigger_action_id` BIGINT UNSIGNED NOT NULL,
    `trigger_action_config_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `schedule_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fail_reason` VARCHAR(191) NULL DEFAULT '',
    `payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_action_agency_user_trigger_contact`(`agency_id`, `user_id`, `trigger_id`, `contact_id`),
    INDEX `idx_action_status_schedule`(`status`, `schedule_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assigned_whatsapp_numbers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `wa_business_number_id` BIGINT UNSIGNED NOT NULL,
    `assigned_by` BIGINT UNSIGNED NULL,
    `assigned_to` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_assigned_whatsapp_agency_user_assignedTo`(`agency_id`, `user_id`, `assigned_to`),
    UNIQUE INDEX `assigned_whatsapp_numbers_assigned_to_wa_business_number_id_key`(`assigned_to`, `wa_business_number_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact_import_queue_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `contact_id` BIGINT UNSIGNED NULL,
    `contact_import_queue_id` BIGINT UNSIGNED NOT NULL,
    `number` VARCHAR(20) NULL,
    `first_name` VARCHAR(100) NULL,
    `last_name` VARCHAR(100) NULL,
    `email` VARCHAR(255) NULL,
    `city` VARCHAR(190) NULL,
    `state` VARCHAR(190) NULL,
    `country` VARCHAR(190) NULL,
    `country_code` VARCHAR(190) NULL,
    `address` TEXT NULL,
    `status` ENUM('CREATED', 'INVALID', 'DUPLICATE', 'UPDATED') NULL,
    `birth_date` DATE NULL,
    `anniversary_date` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_userid_contact_import_queue_id`(`user_id`, `contact_import_queue_id`),
    INDEX `idx_createdby_contact_import_queue_id`(`created_by`, `contact_import_queue_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `google_contact_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `agency_id` BIGINT UNSIGNED NOT NULL,
    `user_request_id` BIGINT UNSIGNED NOT NULL,
    `contact_id` BIGINT UNSIGNED NULL,
    `number` VARCHAR(20) NULL,
    `country` VARCHAR(191) NULL,
    `country_code` VARCHAR(20) NULL,
    `first_name` VARCHAR(100) NULL,
    `last_name` VARCHAR(100) NULL,
    `email` VARCHAR(191) NULL,
    `status` ENUM('CREATED', 'INVALID', 'DUPLICATE', 'UPDATED') NULL,
    `invalid_reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `idx_userid_user_request_id`(`user_id`, `user_request_id`),
    INDEX `idx_createdby_user_request_id`(`created_by`, `user_request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `contact_sources` ADD CONSTRAINT `fk_contact_sources_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_packages` ADD CONSTRAINT `fk_billing_packages_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `permissions` ADD CONSTRAINT `fk_permissions_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `fk_users_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `fk_users_parent_user` FOREIGN KEY (`parent_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_packages` ADD CONSTRAINT `fk_user_packages_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_packages` ADD CONSTRAINT `fk_user_packages_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_packages` ADD CONSTRAINT `fk_user_packages_package` FOREIGN KEY (`package_id`) REFERENCES `billing_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teams` ADD CONSTRAINT `fk_teams_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teams` ADD CONSTRAINT `fk_teams_owner` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_members` ADD CONSTRAINT `fk_team_members_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_members` ADD CONSTRAINT `fk_team_members_team` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_members` ADD CONSTRAINT `fk_team_members_user` FOREIGN KEY (`member_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_import_queues` ADD CONSTRAINT `fk_contact_import_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_import_queues` ADD CONSTRAINT `fk_contact_import_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_import_queues` ADD CONSTRAINT `fk_contact_import_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contacts` ADD CONSTRAINT `fk_contacts_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contacts` ADD CONSTRAINT `fk_contacts_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contacts` ADD CONSTRAINT `fk_contacts_source` FOREIGN KEY (`source_id`) REFERENCES `contact_sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contacts` ADD CONSTRAINT `fk_contact_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_import_queue_contacts` ADD CONSTRAINT `fk_queue_contacts_queue` FOREIGN KEY (`queue_id`) REFERENCES `contact_import_queues`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_import_queue_contacts` ADD CONSTRAINT `fk_queue_contacts_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_import_queue_contacts` ADD CONSTRAINT `fk_queue_contacts_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_import_queue_contacts` ADD CONSTRAINT `fk_queue_contacts_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_import_queue_contacts` ADD CONSTRAINT `fk_queue_contacts_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `personalizations` ADD CONSTRAINT `fk_personalizations_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `personalizations` ADD CONSTRAINT `fk_personalizations_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `personalizations` ADD CONSTRAINT `fk_personalizations_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custom_fields` ADD CONSTRAINT `fk_custom_fields_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custom_fields` ADD CONSTRAINT `fk_custom_fields_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custom_fields` ADD CONSTRAINT `fk_custom_fields_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_custom_fields` ADD CONSTRAINT `fk_contact_custom_fields_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_custom_fields` ADD CONSTRAINT `fk_contact_custom_fields_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_custom_fields` ADD CONSTRAINT `fk_contact_custom_fields_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_custom_fields` ADD CONSTRAINT `fk_contact_custom_fields_field` FOREIGN KEY (`custom_field_id`) REFERENCES `custom_fields`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_custom_fields` ADD CONSTRAINT `fk_contact_custom_fields_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `send_logs` ADD CONSTRAINT `fk_send_logs_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `send_logs` ADD CONSTRAINT `fk_send_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `send_logs` ADD CONSTRAINT `fk_send_logs_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meta_oauth_tokens` ADD CONSTRAINT `fk_meta_oauth_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meta_oauth_tokens` ADD CONSTRAINT `fk_meta_oauth_tokens_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `segments` ADD CONSTRAINT `fk_segments_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `segments` ADD CONSTRAINT `fk_segments_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `segments` ADD CONSTRAINT `fk_segments_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `segment_contacts` ADD CONSTRAINT `fk_segment_contacts_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `segment_contacts` ADD CONSTRAINT `fk_segment_contacts_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `segment_contacts` ADD CONSTRAINT `fk_segment_contacts_segment` FOREIGN KEY (`segment_id`) REFERENCES `segments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `segment_contacts` ADD CONSTRAINT `fk_segment_contacts_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `segment_contacts` ADD CONSTRAINT `fk_segment_contacts_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sso_providers` ADD CONSTRAINT `fk_sso_providers_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sso_providers` ADD CONSTRAINT `fk_sso_providers_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_templates` ADD CONSTRAINT `fk_message_templates_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_templates` ADD CONSTRAINT `fk_message_templates_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_templates` ADD CONSTRAINT `fk_message_templates_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_template_summaries` ADD CONSTRAINT `fk_message_template_summary_template` FOREIGN KEY (`message_template_id`) REFERENCES `message_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_contact_id_fkey` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_segment_id_fkey` FOREIGN KEY (`segment_id`) REFERENCES `segments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_trigger_id_fkey` FOREIGN KEY (`trigger_id`) REFERENCES `triggers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_broadcast_id_fkey` FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_message_template_id_fkey` FOREIGN KEY (`message_template_id`) REFERENCES `message_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_custom_field_id_fkey` FOREIGN KEY (`custom_field_id`) REFERENCES `custom_fields`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_wa_business_number_id_fkey` FOREIGN KEY (`wa_business_number_id`) REFERENCES `wa_business_numbers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_wa_business_account_id_fkey` FOREIGN KEY (`wa_business_account_id`) REFERENCES `wa_business_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_fb_business_account_id_fkey` FOREIGN KEY (`fb_business_account_id`) REFERENCES `fb_business_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_user_setting_id_fkey` FOREIGN KEY (`user_setting_id`) REFERENCES `user_settings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_personalization_id_fkey` FOREIGN KEY (`personalization_id`) REFERENCES `personalizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tokens` ADD CONSTRAINT `fk_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fb_business_accounts` ADD CONSTRAINT `fk_fb_business_accounts_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fb_business_accounts` ADD CONSTRAINT `fk_fb_business_accounts_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_business_accounts` ADD CONSTRAINT `fk_wa_business_accounts_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_business_accounts` ADD CONSTRAINT `fk_wa_business_accounts_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_business_accounts` ADD CONSTRAINT `fk_wa_business_accounts_fb_business` FOREIGN KEY (`fb_business_id`) REFERENCES `fb_business_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_business_numbers` ADD CONSTRAINT `fk_wa_business_numbers_meta_oauth_token` FOREIGN KEY (`meta_oauth_token_id`) REFERENCES `meta_oauth_tokens`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_business_numbers` ADD CONSTRAINT `fk_wa_business_numbers_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_business_numbers` ADD CONSTRAINT `fk_wa_business_numbers_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_business_numbers` ADD CONSTRAINT `fk_wa_business_numbers_waba_account` FOREIGN KEY (`wa_business_account_id`) REFERENCES `wa_business_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_business_profiles` ADD CONSTRAINT `fk_wa_business_profiles_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_business_profiles` ADD CONSTRAINT `fk_wa_business_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_business_profiles` ADD CONSTRAINT `fk_wa_business_profiles_waba_account` FOREIGN KEY (`waba_id`) REFERENCES `wa_business_accounts`(`wabaId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agency_settings` ADD CONSTRAINT `fk_agency_settings_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_settings` ADD CONSTRAINT `fk_user_settings_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_settings` ADD CONSTRAINT `fk_user_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_transactions` ADD CONSTRAINT `fk_billing_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_transactions` ADD CONSTRAINT `fk_billing_transactions_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_transactions` ADD CONSTRAINT `fk_billing_transactions_billing_package` FOREIGN KEY (`billing_package_id`) REFERENCES `billing_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_transactions` ADD CONSTRAINT `fk_billing_transactions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_transactions` ADD CONSTRAINT `fk_billing_transactions_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_transactions` ADD CONSTRAINT `fk_billing_transactions_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_transactions` ADD CONSTRAINT `fk_billing_transactions_broadcast` FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_transactions` ADD CONSTRAINT `fk_billing_transactions_broadcast_setting` FOREIGN KEY (`broadcast_setting_id`) REFERENCES `broadcast_settings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_transactions` ADD CONSTRAINT `fk_billing_transactions_messaging_pricing` FOREIGN KEY (`messaging_pricing_id`) REFERENCES `messaging_pricings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_threads` ADD CONSTRAINT `fk_inbox_threads_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_threads` ADD CONSTRAINT `fk_inbox_threads_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_threads` ADD CONSTRAINT `fk_inbox_threads_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inbox_threads` ADD CONSTRAINT `fk_inbox_threads_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `fk_conversations_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `fk_conversations_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `fk_conversations_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `fk_conversations_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcasts` ADD CONSTRAINT `fk_broadcast_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcasts` ADD CONSTRAINT `fk_broadcast_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcasts` ADD CONSTRAINT `fk_broadcasts_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_summaries` ADD CONSTRAINT `fk_broadcast_summary_broadcast` FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_settings` ADD CONSTRAINT `fk_broadcast_setting_wa_number` FOREIGN KEY (`wa_business_number_id`) REFERENCES `wa_business_numbers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_settings` ADD CONSTRAINT `fk_broadcast_setting_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_settings` ADD CONSTRAINT `fk_broadcast_setting_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_settings` ADD CONSTRAINT `fk_broadcast_setting_broadcast` FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_settings` ADD CONSTRAINT `fk_broadcast_setting_message_template` FOREIGN KEY (`message_template_id`) REFERENCES `message_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_settings` ADD CONSTRAINT `fk_broadcast_settings_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_message_queues` ADD CONSTRAINT `fk_bmq_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_message_queues` ADD CONSTRAINT `fk_bmq_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_message_queues` ADD CONSTRAINT `fk_bmq_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_message_queues` ADD CONSTRAINT `fk_bmq_broadcast` FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_message_queues` ADD CONSTRAINT `fk_bmq_broadcast_setting` FOREIGN KEY (`broadcast_setting_id`) REFERENCES `broadcast_settings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_message_queues` ADD CONSTRAINT `fk_bmq_wa_business_number` FOREIGN KEY (`wa_business_number_id`) REFERENCES `wa_business_numbers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_message_queues` ADD CONSTRAINT `fk_broadcast_message_queues_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_message_logs` ADD CONSTRAINT `fk_bml_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_message_logs` ADD CONSTRAINT `fk_bml_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_message_logs` ADD CONSTRAINT `fk_bml_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_message_logs` ADD CONSTRAINT `fk_bml_broadcast` FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_message_logs` ADD CONSTRAINT `fk_bml_broadcast_setting` FOREIGN KEY (`broadcast_setting_id`) REFERENCES `broadcast_settings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_message_logs` ADD CONSTRAINT `fk_bml_wa_business_account` FOREIGN KEY (`wa_business_account_id`) REFERENCES `wa_business_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_message_logs` ADD CONSTRAINT `fk_bml_fb_business` FOREIGN KEY (`fb_business_id`) REFERENCES `fb_business_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_message_logs` ADD CONSTRAINT `fk_bml_wa_business_number` FOREIGN KEY (`wa_business_number_id`) REFERENCES `wa_business_numbers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_message_logs` ADD CONSTRAINT `fk_broadcast_message_logs_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `integrations` ADD CONSTRAINT `fk_integrations_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `integrations` ADD CONSTRAINT `fk_integrations_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_card_infos` ADD CONSTRAINT `fk_user_card_infos_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_card_infos` ADD CONSTRAINT `fk_user_card_infos_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stripe_webhook_events` ADD CONSTRAINT `fk_stripe_webhook_events_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stripe_webhook_events` ADD CONSTRAINT `fk_stripe_webhook_events_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_packages_histories` ADD CONSTRAINT `fk_user_packages_histories_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_packages_histories` ADD CONSTRAINT `fk_user_packages_histories_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_package_renew_histories` ADD CONSTRAINT `fk_user_package_renew_histories_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_package_renew_histories` ADD CONSTRAINT `fk_user_package_renew_histories_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tags` ADD CONSTRAINT `fk_tags_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tags` ADD CONSTRAINT `fk_tags_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tags` ADD CONSTRAINT `fk_tags_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_tags` ADD CONSTRAINT `fk_contact_tags_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_tags` ADD CONSTRAINT `fk_contact_tags_tag` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_tags` ADD CONSTRAINT `fk_contact_tags_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_tags` ADD CONSTRAINT `fk_contact_tags_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_tags` ADD CONSTRAINT `fk_contact_tags_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_assignments` ADD CONSTRAINT `fk_contact_assignments_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_assignments` ADD CONSTRAINT `fk_contact_assignments_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_assignments` ADD CONSTRAINT `fk_contact_assignments_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_assignments` ADD CONSTRAINT `fk_contact_assignments_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_assignments` ADD CONSTRAINT `fk_contact_assignments_assigned_to` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_notification_tokens` ADD CONSTRAINT `fk_user_notification_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_notification_tokens` ADD CONSTRAINT `fk_user_notification_tokens_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `fk_notifications_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `fk_notifications_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_auto_recharge_histories` ADD CONSTRAINT `fk_uarh_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_auto_recharge_histories` ADD CONSTRAINT `fk_uarh_card_info` FOREIGN KEY (`card_info_id`) REFERENCES `user_card_infos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_auto_recharge_histories` ADD CONSTRAINT `fk_uarh_package` FOREIGN KEY (`package_id`) REFERENCES `billing_packages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meta_data_sync_jobs` ADD CONSTRAINT `fk_meta_data_sync_jobs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meta_data_sync_jobs` ADD CONSTRAINT `fk_meta_data_sync_jobs_oauth_token` FOREIGN KEY (`meta_oauth_token_id`) REFERENCES `meta_oauth_tokens`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_requests` ADD CONSTRAINT `fk_user_requests_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_requests` ADD CONSTRAINT `fk_user_requests_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_requests` ADD CONSTRAINT `fk_user_requests_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_request_logs` ADD CONSTRAINT `fk_user_request_logs_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_request_logs` ADD CONSTRAINT `fk_user_request_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_request_logs` ADD CONSTRAINT `fk_user_request_logs_user_request` FOREIGN KEY (`user_request_id`) REFERENCES `user_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opt_out_contacts` ADD CONSTRAINT `fk_opt_out_contacts_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opt_out_contacts` ADD CONSTRAINT `fk_opt_out_contacts_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opt_out_contacts` ADD CONSTRAINT `fk_opt_out_contacts_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opt_out_contacts` ADD CONSTRAINT `fk_opt_out_contacts_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `triggers` ADD CONSTRAINT `fk_trigger_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `triggers` ADD CONSTRAINT `fk_trigger_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `triggers` ADD CONSTRAINT `fk_trigger_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_configs` ADD CONSTRAINT `fk_trigger_event_configs_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_configs` ADD CONSTRAINT `fk_trigger_event_configs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_configs` ADD CONSTRAINT `fk_trigger_event_configs_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_configs` ADD CONSTRAINT `fk_trigger_event_configs_trigger` FOREIGN KEY (`trigger_id`) REFERENCES `triggers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_configs` ADD CONSTRAINT `fk_trigger_event_configs_event` FOREIGN KEY (`trigger_event_id`) REFERENCES `trigger_events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_action_configs` ADD CONSTRAINT `fk_trigger_action_configs_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_action_configs` ADD CONSTRAINT `fk_trigger_action_configs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_action_configs` ADD CONSTRAINT `fk_trigger_action_configs_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_action_configs` ADD CONSTRAINT `fk_trigger_action_configs_trigger` FOREIGN KEY (`trigger_id`) REFERENCES `triggers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_action_configs` ADD CONSTRAINT `fk_trigger_action_configs_event` FOREIGN KEY (`trigger_event_id`) REFERENCES `trigger_events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_action_configs` ADD CONSTRAINT `fk_trigger_action_configs_event_config` FOREIGN KEY (`trigger_event_config_id`) REFERENCES `trigger_event_configs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_action_configs` ADD CONSTRAINT `fk_trigger_action_configs_action` FOREIGN KEY (`action_id`) REFERENCES `trigger_actions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_execution_logs` ADD CONSTRAINT `fk_trigger_event_execution_logs_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_execution_logs` ADD CONSTRAINT `fk_trigger_event_execution_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_execution_logs` ADD CONSTRAINT `fk_trigger_event_execution_logs_trigger` FOREIGN KEY (`trigger_id`) REFERENCES `triggers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_execution_logs` ADD CONSTRAINT `fk_trigger_event_execution_logs_event` FOREIGN KEY (`trigger_event_id`) REFERENCES `trigger_events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_execution_logs` ADD CONSTRAINT `fk_trigger_event_execution_logs_event_config` FOREIGN KEY (`trigger_event_config_id`) REFERENCES `trigger_event_configs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_execution_logs` ADD CONSTRAINT `fk_trigger_event_execution_logs_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_action_execution_logs` ADD CONSTRAINT `fk_trigger_event_action_execution_logs_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_action_execution_logs` ADD CONSTRAINT `fk_trigger_event_action_execution_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_action_execution_logs` ADD CONSTRAINT `fk_trigger_event_action_execution_logs_trigger` FOREIGN KEY (`trigger_id`) REFERENCES `triggers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_action_execution_logs` ADD CONSTRAINT `fk_trigger_event_action_execution_logs_event` FOREIGN KEY (`trigger_event_id`) REFERENCES `trigger_events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_action_execution_logs` ADD CONSTRAINT `fk_trigger_event_action_execution_logs_event_config` FOREIGN KEY (`trigger_event_config_id`) REFERENCES `trigger_event_configs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_action_execution_logs` ADD CONSTRAINT `fk_trigger_event_action_execution_logs_action` FOREIGN KEY (`trigger_action_id`) REFERENCES `trigger_actions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_action_execution_logs` ADD CONSTRAINT `fk_trigger_event_action_execution_logs_action_config` FOREIGN KEY (`trigger_action_config_id`) REFERENCES `trigger_action_configs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trigger_event_action_execution_logs` ADD CONSTRAINT `fk_trigger_event_action_execution_logs_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gmail_imported_contacts` ADD CONSTRAINT `fk_gmail_imported_contacts_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gmail_imported_contacts` ADD CONSTRAINT `fk_gmail_imported_contacts_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gmail_imported_contacts` ADD CONSTRAINT `fk_gmail_imported_contacts_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gmail_imported_contacts` ADD CONSTRAINT `fk_gmail_imported_contacts_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gmail_imported_contacts` ADD CONSTRAINT `fk_gmail_imported_contacts_gmail_account` FOREIGN KEY (`gmail_account_id`) REFERENCES `gmail_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gmail_accounts` ADD CONSTRAINT `fk_gmail_accounts_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gmail_accounts` ADD CONSTRAINT `fk_gmail_accounts_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_contacts` ADD CONSTRAINT `fk_broadcast_contacts_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_contacts` ADD CONSTRAINT `fk_broadcast_contacts_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_contacts` ADD CONSTRAINT `fk_broadcast_contacts_broadcast` FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_contacts` ADD CONSTRAINT `fk_broadcast_contacts_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_contacts` ADD CONSTRAINT `fk_broadcast_contacts_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messaging_pricings` ADD CONSTRAINT `fk_messaging_pricing_package` FOREIGN KEY (`package_id`) REFERENCES `billing_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messaging_pricings` ADD CONSTRAINT `fk_messaging_pricing_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gateway_credentials` ADD CONSTRAINT `fk_gateway_credentials_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gateway_credentials` ADD CONSTRAINT `fk_gateway_credentials_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assigned_whatsapp_numbers` ADD CONSTRAINT `assigned_whatsapp_numbers_wa_business_number_id_fkey` FOREIGN KEY (`wa_business_number_id`) REFERENCES `wa_business_numbers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assigned_whatsapp_numbers` ADD CONSTRAINT `fk_assigned_whatsapp_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assigned_whatsapp_numbers` ADD CONSTRAINT `fk_assigned_whatsapp_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assigned_whatsapp_numbers` ADD CONSTRAINT `fk_assigned_whatsapp_by_user` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assigned_whatsapp_numbers` ADD CONSTRAINT `fk_assigned_whatsapp_to_user` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact_import_queue_logs` ADD CONSTRAINT `fk_queue_contacts_logs` FOREIGN KEY (`contact_import_queue_id`) REFERENCES `contact_import_queues`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

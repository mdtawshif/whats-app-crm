import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDate,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  IsInt,
  Min,
  Matches // Add Matches import
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

//  One correct 24h regex for reuse
const HHMM_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** Helpers to map "HH:mm" <-> Date anchored at 1970-01-01 UTC */
function hhmmToUtcDate(hhmm?: string): Date | undefined {
  if (typeof hhmm !== 'string' || !HHMM_REGEX.test(hhmm)) {
    return undefined; // <-- return undefined so @IsOptional skips @IsDate
  }
  const [hours, minutes] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

/** Compare two HH:mm strings */
function compareHHMM(a: string, b: string): number {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  if (ah !== bh) return ah - bh;
  return am - bm;
}

/** Ensures startTime < endTime (attach on `endTime`) */
@ValidatorConstraint({ name: 'IsTimeRangeValid', async: false })
export class IsTimeRangeValid implements ValidatorConstraintInterface {
  validate(endTime: string, args: ValidationArguments): boolean {
    const { startTime } = args.object as CreateBroadcastDto;
    if (!startTime || !endTime) return true;
    if (!HHMM_REGEX.test(startTime) || !HHMM_REGEX.test(endTime)) return true;
    return compareHHMM(startTime, endTime) < 0;
  }
  defaultMessage(): string {
    return 'startTime must be earlier than endTime.';
  }
}


@ValidatorConstraint({ name: 'IsDateRangeValid', async: false })
export class IsDateRangeValid implements ValidatorConstraintInterface {
  validate(toDate: string, args: ValidationArguments): boolean {
    const obj = args.object as { fromDate?: string };
    if (!obj.fromDate || !toDate) return true; // field-level validators handle required/format
    const from = new Date(obj.fromDate);
    const to = new Date(toDate);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return true;
    return from.getTime() <= to.getTime();
  }
  defaultMessage(): string {
    return 'fromDate must be on or before toDate.';
  }
}

/** Example payload
 * {
 *   "title": "Summer Sale Campaign",
 *   "fromDate": "2024-06-15T00:00:00Z",
 *   "toDate": "2024-06-30T23:59:59Z",
 *   "selectedDays": ["Monday", "Wednesday", "Friday"],
 *   "startTime": "09:00",
 *   "endTime": "17:00"
 * }
 */
export enum DayOfWeek {
  Monday = 'Monday',
  Tuesday = 'Tuesday',
  Wednesday = 'Wednesday',
  Thursday = 'Thursday',
  Friday = 'Friday',
  Saturday = 'Saturday',
  Sunday = 'Sunday',
}

export class CreateBroadcastDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id?: number;

  @ApiProperty({
    description: 'WhatsApp Business Account ID (digits only)',
    example: '2911168089062645',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  wabaId!: string;

  @ApiProperty({ description: 'Campaign title', example: 'Summer Sale Campaign', required: true })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @ApiProperty({ description: 'Inclusive ISO8601 start datetime (UTC recommended)', example: '2024-06-15T00:00:00Z', required: true })
  @IsISO8601()
  fromDate!: string;

  @ApiProperty({ description: 'Inclusive ISO8601 end datetime (UTC recommended)', example: '2024-06-30T23:59:59Z', required: true })
  @IsISO8601()
  @Validate(IsDateRangeValid)
  toDate!: string;

  @ApiProperty({
    description: 'Days of the week when the broadcast is active',
    isArray: true,
    enum: DayOfWeek,
    example: ['Monday', 'Wednesday', 'Friday'],
    required: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(DayOfWeek, { each: true })
  selectedDays!: DayOfWeek[];

  @ApiProperty({ description: 'Daily start time (HH:mm, 24h)', example: '09:00', required: true })
  @Matches(HHMM_REGEX, { message: 'startTime must be in HH:mm format (00:00–23:59)' })
  startTime!: string;

  @ApiProperty({ description: 'Daily end time (HH:mm, 24h)', example: '17:00', required: true })
  @Matches(HHMM_REGEX, { message: 'endTime must be in HH:mm format (00:00–23:59)' })
  @Validate(IsTimeRangeValid)
  endTime!: string;

  /** Hidden, derived times you can pass directly to Prisma (DateTime @db.Time) */
  @ApiHideProperty()
  @IsOptional()
  @Transform(({ obj }) => hhmmToUtcDate(obj?.startTime), { toClassOnly: true })
  @IsDate({ message: 'Invalid startTime format; must be HH:mm (00:00–23:59)' })
  startTimeDate?: Date;

  @ApiHideProperty()
  @IsOptional()
  @Transform(({ obj }) => hhmmToUtcDate(obj?.endTime), { toClassOnly: true })
  @IsDate({ message: 'Invalid endTime format; must be HH:mm (00:00–23:59)' })
  endTimeDate?: Date;

}



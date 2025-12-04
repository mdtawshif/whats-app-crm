/**
 * @Milton463
 */
export interface WAMessageResponse {
    statusCode?: number,
    twilioMessageResponse?: TwilioMessageResponse
    errorCode?: number,
    errorMessage?:string
    success: boolean,
}

export interface TwilioMessageResponse {
    account_sid: string;
    api_version: string;
    body: string;
    date_created: string; 
    date_sent: string | null;
    date_updated: string;
    direction: string;  
    error_code: string | null;
    error_message: string | null;
    from: string;  
    messaging_service_sid: string | null;
    num_media: string;
    num_segments: string;
    price: string | null;
    price_unit: string | null;
    sid: string;
    status: string; 
    subresource_uris: {
        media: string;
    };
    to: string;  
    uri: string;
}

/**
 *  {
        "code": 21212,
        "message": "The 'From' number  is not a valid phone number, shortcode, or alphanumeric sender ID.",
        "more_info": "https://www.twilio.com/docs/errors/21212",
        "status": 400
    }
 */
export interface TwilioWaErrorResponse{
    code: number
    message: string
    status: number
    more_info: string
}


export enum TwilioMessageStatus {
    QUEUED = "queued",
    SENDING = "sending",
    SENT = "sent",
    DELIVERED = "delivered",
    UNDELIVERED = "undelivered",
    FAILED = "failed",
    READ = "read",
    RECEIVED ="received "
}

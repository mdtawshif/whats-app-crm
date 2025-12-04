import { TwilioMessageStatus } from 'src/modules/gateway-provider/twilio.message.response';

// Common Twilio WhatsApp-specific error codes
// Reference: https://www.twilio.com/docs/api/errors
interface TwilioError {
    code: number;
    message: string;
    userMessage: string;
}

const TWILIO_ERROR_MAP: Record<number, TwilioError> = {
    20003: {
        code: 20003,
        message: 'Authentication Error - Invalid Account SID or Auth Token',
        userMessage: 'Oops, something went wrong with our connection. Please try again later.',
    },
    21211: {
        code: 21211,
        message: 'Invalid "To" Phone Number',
        userMessage: 'The phone number you’re trying to message isn’t valid. Double-check and try again.',
    },
    21610: {
        code: 21610,
        message: 'Message cannot be sent: phone number is blocked or opted out',
        userMessage: 'This contact has blocked messages or opted out. Try another number.',
    },
    63001: {
        code: 63001,
        message: 'Rate limit exceeded for WhatsApp messages',
        userMessage: 'We’re hitting a messaging limit. Please wait a moment and try again.',
    },
    63002: {
        code: 63002,
        message: 'Account rate limit exceeded',
        userMessage: 'Too many messages sent too quickly. Please wait and try again.',
    },
    63010: {
        code: 63010,
        message: 'Invalid media in message',
        userMessage: 'The media you’re trying to send isn’t supported. Try a different file.',
    },
    63016: {
        code: 63016,
        message: 'Message cannot be sent: WhatsApp user has not opted in',
        userMessage: 'This contact hasn’t opted into WhatsApp messages. Ask them to opt in first.',
    },
    63018: {
        code: 63018,
        message: 'Message body is invalid or empty',
        userMessage: 'Your message is empty or invalid. Add some text and try again.',
    },
    63032: {
        code: 63032,
        message: 'Template not approved or not found',
        userMessage: 'The message template isn’t approved yet. Check your template settings.',
    },
    30001: {
        code: 30001,
        message: 'Queue overflow',
        userMessage: 'Our messaging system is a bit overloaded. Please try again in a moment.',
    },
    30005: {
        code: 30005,
        message: 'Unknown or blocked destination number',
        userMessage: 'The number you’re trying to reach isn’t available. Verify the number and try again.',
    },
    30008: {
        code: 30008,
        message: 'Unknown error',
        userMessage: 'Something went wrong on our end. Please try again later.',
    },
};

// Fallback for unknown errors
const DEFAULT_ERROR: TwilioError = {
    code: 0,
    message: 'Unknown error occurred',
    userMessage: 'Something unexpected happened. Please try again or contact support.',
};

// Utility function to format Twilio error messages
export function formatTwilioError({
    errorCode,
    statusCode,
    errorMessage,
    twilioStatus,
}: {
    errorCode?: number | null;
    statusCode?: number | null;
    errorMessage?: string | null;
    twilioStatus?: TwilioMessageStatus | null;
}): { userMessage: string; technicalMessage: string } {
    let technicalMessage = errorMessage || 'No error message provided';
    let userMessage = DEFAULT_ERROR.userMessage;
    // Debug logging (commented out for production)
    // console.log({ errorCode, statusCode, stat: statusCode === 429, errorMessage, twilioStatus });

    // 1. Handle Twilio-specific error codes first (highest precedence)
    if (errorCode && TWILIO_ERROR_MAP[errorCode]) {
        userMessage = TWILIO_ERROR_MAP[errorCode].userMessage;
        technicalMessage = `Twilio Error ${errorCode}: ${TWILIO_ERROR_MAP[errorCode].message}`;
        return { userMessage, technicalMessage };
    }

    // 2. Handle HTTP status codes (including 429)
    if (statusCode) {
        if (statusCode === 429) {

            userMessage = 'Too many requests sent. Please wait a bit and try again.';
            technicalMessage = `Rate limit exceeded (HTTP ${statusCode}): ${errorMessage || 'Too many requests'}`;
        } else if (statusCode >= 500) {
            userMessage = 'Our servers are having a moment. Please try again soon.';
            technicalMessage = `Server error (HTTP ${statusCode}): ${errorMessage || 'No details provided'}`;
        } else if (statusCode === 401 || statusCode === 403) {
            userMessage = 'Authentication issue. Please check your credentials and try again.';
            technicalMessage = `Auth error (HTTP ${statusCode}): ${errorMessage || 'Invalid credentials'}`;
        } else if (statusCode === 400) {
            userMessage = 'Something’s wrong with the request. Double-check your input.';
            technicalMessage = `Bad request (HTTP ${statusCode}): ${errorMessage || 'Invalid request format'}`;
        }

        return { userMessage, technicalMessage };
    }


    // 3. Handle Twilio message status (e.g., FAILED, UNDELIVERED)
    if (twilioStatus) {
        if (twilioStatus === TwilioMessageStatus.FAILED || twilioStatus === TwilioMessageStatus.UNDELIVERED) {
            userMessage = 'We couldn’t deliver your message. Check the number or try again.';
            technicalMessage = `Message status: ${twilioStatus}. ${errorMessage || 'No additional details'}`;
            return { userMessage, technicalMessage };
        }
    }

    // 4. Fallback for unknown errors
    return { userMessage, technicalMessage };
}
export const GOOGLE_DRIVE_CONNECT_REQUEST_TEMPLATE_BODY = `
<div style="font-family: Arial, sans-serif; text-align: center;">
    <h2 style="color: #333;">⚠️ Action Required: Connect Your Google Drive</h2>
    <p style="color: #555; font-size: 16px;">
        To ensure your files are safely stored, please connect your Google Drive to our app. 
        If this connection is not made within <strong>24 hours</strong>, your content will be 
        <span style="color: #d9534f; font-weight: bold;">automatically deleted</span>.
    </p>
</div>
<p>Kind regards,</p>
<p>The {{agency.title}} Team</p>
`;

export const GOOGLE_DRIVE_RECONNECT_TEMPLATE_BODY = `
<div style="font-family: Arial, sans-serif; text-align: center;">
    <h2 style="color: #333;">⚠️ Urgent: Reconnect Your Google Drive</h2>
    <p style="color: #555; font-size: 16px;">
        It appears that your Google Drive has been disconnected from our app. To ensure your files remain securely stored, please reconnect your Google Drive as soon as possible.
    </p>
    <p style="color: #d9534f; font-size: 16px; font-weight: bold;">
        Important: If you do not reconnect within <strong>24 hours</strong>, your content will be <span style="color: #d9534f; font-weight: bold;">automatically deleted</span>.
    </p>
</div>
<p>Kind regards,</p>
<p>The {{agency.title}} Team</p>
`;

export const GOOGLE_DRIVE_RECONNECT_TEMPLATE_SUBJECT =
    'Urgent: Connect Your Google Drive to Secure Your Files';

export const GOOGLE_DRIVE_EXTEND_REQUEST_BODY = `
<div style="font-family: Arial, sans-serif; text-align:">
    <h2 style="color: #333;">Unable to Upload: Google Drive Storage Full</h2>
    <p style="color: #555; font-size: 16px;">
        We were unable to upload your content to Google Drive because your storage is full. To continue saving your files, please free up some space or extend your storage plan.
    </p>
    <p style="color: #d9534f; font-size: 16px; font-weight: bold;">
        Please note: If this issue is not resolved within <strong>24 hours</strong>, your content may be permanently deleted.
    </p>
    <p style="color: #555; font-size: 16px;">
        Ensure your important files are safely stored by addressing this issue as soon as possible.
    </p>
</div>
<p>Kind regards,</p>
<p>The {{agency.title}} Team</p>
`;
export const GOOGLE_DRIVE_EXTEND_REQUEST_SUBJECT =
    'Urgent: Unable to Upload - Your Google Drive Storage is Full';

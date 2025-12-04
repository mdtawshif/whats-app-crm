/* eslint-disable @typescript-eslint/no-unused-vars */
import axios, { HttpStatusCode } from "axios";
import { ICreateMessageTemplate, ITextMessage, IUploadMetaImage } from "./interface.dt";
import { Multipart } from "@fastify/multipart";
import { AccessTokenResponse } from "src/modules/whatsapp/interface/waba.integration.interface";
import crypto from 'crypto';
import { CodeVerificationStatus, Gateway, NumberQualityRating } from "@prisma/client";
import { TemplateCreationDto } from "src/modules/whatsapp/dto/wa.message.template.dto";
import { GatewayAuth } from "src/modules/gateway-provider/twilio.wa.msg.request";

const {
  FB_APP_ID,
  GRAPH_VERSION = 'v20.0',
  FB_APP_SECRET,
  FB_SCOPES
} = process.env;
const APP_ACCESS_TOKEN = `${FB_APP_ID}|${FB_APP_SECRET}`;

export const ALLOWED_META_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'video/mp4',
];

export const uploadMetaImage = async (args: IUploadMetaImage) => {
  const res = await axios.post(
    `https://graph.facebook.com/${GRAPH_VERSION}/${FB_APP_ID}/uploads`,
    null,
    {
      maxBodyLength: Infinity,
      headers: {
        Authorization: 'Bearer ' + args.token
      },
      params: {
        file_name: args.fileName,
        file_length: args.fileLength,
        file_type: args.fileType,
        access_token: args.token
      }
    }
  )
  if (res.status === HttpStatusCode.Ok) {
    if (args.file && args.buffer) {
      const fileMetaHeader = await uploadMetaFileSession(
        res.data.id,
        args.file,
        args.token,
        args.fileName,
        args.buffer
      )
      if (fileMetaHeader) {
        return fileMetaHeader;
      }
    }

  }
  return null;
};

export const uploadMetaFileSession = async (session_id: string, data: Multipart, token: string, fileName: string, buffer: Buffer<ArrayBufferLike>) => {
  try {
    const res = await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${session_id}`,
      buffer,
      {
        maxBodyLength: Infinity,
        headers: {
          'file_offset': '0',
          'Content-Type': data.mimetype,
          'Authorization': 'Bearer ' + token,
          "Content-Length": buffer.length.toString(),
        }
      }

    )
    if (res.status === HttpStatusCode.Ok) {
      return res.data.h;
    }
  }
  catch (_) {
    return null;
  }
}

export const createMessageTemplate = async (payload: ICreateMessageTemplate, wabaId: string, token: string) => {
  try {
    const res = await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`,
      JSON.stringify({ ...payload, parameter_format: 'NAMED' }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      }
    );
    if (res.status === HttpStatusCode.Ok) {
      return {
        status: true,
        data: res.data
      }
    }
    return {
      status: false,
      message: 'Something went wrong !'
    };
  }
  catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const headers = err.response?.headers ?? {};
      const body = err.response?.data ?? {};
      // Meta error shape
      const metaErr = body?.error ?? {};
      const detail = {
        http_status: status,
        fbtrace_id: metaErr.fbtrace_id || headers['x-fb-trace-id'],
        type: metaErr.type,
        code: metaErr.code,
        error_subcode: metaErr.error_subcode,
        message: metaErr.message,
        error_user_title: metaErr.error_user_title,
        error_user_msg: metaErr.error_user_msg,
      };

      // Example: handle some known cases programmatically
      if (metaErr.error_subcode === 3835016) {
        // WABA restricted from creating templates
        // -> show friendly msg or guide to appeal
        return {
          status: false,
          message: 'WABA restricted from creating templates',
          details: detail
        };
      }
      if (metaErr.error_subcode === 2388024) {
        // WABA restricted from creating templates
        // -> show friendly msg or guide to appeal
        return {
          status: false,
          message: 'Content in this language already exists',
          details: detail
        };
      }
    } else {
      console.error('Non-Axios error:', err);
    }
    return {
      status: false,
      message: 'Something went wrong',
      details: null,
    };
  }
}

export const freshToken = async (accessToken: string) => {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`;
  const params = {
    grant_type: 'fb_exchange_token',
    client_id: FB_APP_ID,
    client_secret: FB_APP_SECRET,
    fb_exchange_token: accessToken
  };
  return await axios.get(url, { params });
}

export const exchangeCodeToAccessTokenOld = async (code: string, redirectUrl: string = ''): Promise<AccessTokenResponse | null> => {
  try {
    const accessToken = await axios.get(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
      {
        params: {
          client_id: FB_APP_ID,
          client_secret: FB_APP_SECRET,
          // redirect_uri: redirectUrl,
          // redirect_uri: "https://www.facebook.com/connect/login_success.html",
          redirect_uri: "https://wagend-app.testdomains1.com/integrations/meta-redirect",
          grant_type: "authorization_code",
          code: code
        }
      }
    );
    return accessToken.data;
  }
  catch (error) {
    console.error("------=====", JSON.stringify(error));
    return null;
  }
}
export const exchangeCodeToAccessToken = async (code: string, redirectUrl: string = ''): Promise<AccessTokenResponse | null> => {
  try {
    console.log("code", code)
    const payload = {
      client_id: FB_APP_ID,
      client_secret: FB_APP_SECRET,
      // redirect_uri: redirectUrl,
      // redirect_uri: "https://www.facebook.com/connect/login_success.html",
      // redirect_uri: "https://wagend-app.testdomains1.com/integrations/meta-redirect",
      grant_type: "authorization_code",
      code: code
    }
    const accessToken = await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
      JSON.stringify(payload),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    return accessToken.data;
  }
  catch (error) {
    console.error("------=====", JSON.stringify(error));
    return null;
  }
}

export const appSecretProof = (access_token: string) => {
  // recommended: appsecret_proof for further Graph calls
  return crypto.createHmac('sha256', FB_APP_SECRET)
    .update(access_token)
    .digest('hex');
}

export const getFbUserData = async (appsecret_proof: unknown, access_token: string) => {
  // Example calls (optional): identify who authorized, list businesses
  const me = await axios.get(
    `https://graph.facebook.com/${GRAPH_VERSION}/me`,
    { params: { access_token, appsecret_proof, fields: 'id,name,email,picture' } }
  );
  return me.data;
}

export const getSelectedBusinessIds = async (access_token: string) => {
  const debug = await axios.get(
    `https://graph.facebook.com/${GRAPH_VERSION}/debug_token`,
    { params: { input_token: access_token, access_token: APP_ACCESS_TOKEN } }
  );
  // console.log('---debug', debug)
  /* 
  data: {
whats-app-crm          |       app_id: '780933804298825',
whats-app-crm          |       type: 'SYSTEM_USER',
whats-app-crm          |       application: 'WAgend',
whats-app-crm          |       data_access_expires_at: 0,
whats-app-crm          |       expires_at: 1762423235,
whats-app-crm          |       is_valid: true,
whats-app-crm          |       issued_at: 1757239234,
whats-app-crm          |       scopes: [Array],
whats-app-crm          |       granular_scopes: [Array],
whats-app-crm          |       user_id: '122095193073004775'
whats-app-crm          |     }
  */
  const data = {
    business_management: [],
    whatsapp_business_management: []
  }
  // const userData = await getSystemUserData(debug.data.data.user_id, access_token)
  // console.log("userData", userData)
  if (debug && debug.data && debug.data.data && debug.data.data.granular_scopes) {
    const granular = debug?.data?.data?.granular_scopes || [];
    console.log('granular', granular)
    granular.map((each: any) => {
      if (each.target_ids) {
        console.log("===========--------============", each.target_ids)
        data[each.scope] = Array.from(new Set(each.target_ids.map(String)))
      }
    })
  }
  return data;

  /* 
  data: {
    app_id: '',
    type: 'USER',
    application: '',
    data_access_expires_at: ,
    expires_at: 1760790168,
    is_valid: true,
    issued_at: 1755615065,
    scopes: [Array],
    granular_scopes: [Array],
    user_id: ''
  }
  */
  /* 
  granular_scopes [
    {
      scope: 'business_management',
      target_ids: []
    },
    {
      scope: 'whatsapp_business_management',
      target_ids: []
    }
  ]
  scopes [
    'business_management',
    'whatsapp_business_management',
    'public_profile'
  ]
 */
}
export const fetchBusinessesDataByIds = async (ids: Array<string | number>, access_token: string) => {
  if (!ids.length) return [];
  const chunks: any = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));

  const results: any = [];
  for (const chunk of chunks) {
    const response = await axios.get(
      `https://graph.facebook.com/${GRAPH_VERSION}/`,
      {
        params: {
          access_token: access_token,
          // Use a single multi-id request
          ids: chunk.join(','),
          fields: 'id,name'
        }
      }
    );
    if (response.status === 200) {
      const map = response?.data || {};
      Object.values(map).forEach((b: { id: string; name: string }) => results.push({ id: String(b.id), name: b.name || null }));
    }
  }
  return results;
}
export const fetchWhatsAppAccountDataByIds = async (ids: Array<string | number>, access_token: string, business_ids: Array<string | number> = []) => {
  if (!ids.length) return [];

  const results: any = [];
  for (const id of ids) {
    const response = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${id}`, {
      headers: {
        Authorization: `Bearer ${access_token}`
      },
      params: {
        fields: "name,id,status,timezone_id,currency,message_template_namespace,owner_business_info"
      }
    });
    if (response.status === 200) {
      if (!business_ids.includes(response.data.owner_business_info.id)) {
        continue;
      }
      const data = { ...response.data };
      const phones = await getPhonesByWabaId(id, access_token);
      data['phones'] = phones;
      results.push(data);
    }
  }
  return results;
}
export const getPhonesByWabaId = async (wabaId: string | number, access_token: string) => {
  const response = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/phone_numbers`, {
    headers: {
      Authorization: `Bearer ${access_token}`
    },
    params: {
      fields: "verified_name,id,status,display_phone_number"
    }
  });
  if (response.status === 200) {
    return response?.data?.data || [];
  }
  return []
}

export const metaAuth = (redirectUrl: string, state: string) => {
  const base = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
  const url =
    `${base}?client_id=${encodeURIComponent(FB_APP_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(FB_SCOPES)}` +
    `&extras=${JSON.stringify({
      featureType: 'WA_EMBEDDED_SIGNUP',
      sessionInfoVersion: '3'
    })}` +
    `&config_id=765941799494895` +
    `&override_default_response_type=true` +
    `&state=${encodeURIComponent(state)}`;
  return url;
}

export const verifySignature = (rawBody: Buffer) => {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', FB_APP_SECRET)
    .update(rawBody)
    .digest('hex');
  return expected;
}

export const getMessageTemplates = async (wabaId: string, accessToken: string, limit: number = 25, nextId: string = "") => {
  let finalUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates?limit=${limit}`;
  if (nextId) {
    finalUrl = finalUrl + "&after=" + nextId
  }
  const response = await axios.get(
    finalUrl,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken
      }
    }
  );
  if (response.status === HttpStatusCode.Ok) {
    const { data, paging } = response.data
    return {
      data: data,
      next: (paging && paging?.next && paging?.cursors) ? paging.cursors.after : null
    }
  }
  return {
    data: [],
    next: null
  }
}

/* send message methods start */
export const sendTextMessage = async (phone_number_id: string, token: string, payload: ITextMessage) => {
  try {
    const res = await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phone_number_id}/messages`,
      JSON.stringify(payload),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      }
    );
    if (res.status === HttpStatusCode.Ok) {
      return {
        status: true,
        data: res.data
      }
    }
    console.error('res:sendTextMessage', res)
    return {
      status: false,
      message: 'Something went wrong !'
    };
  }
  catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const headers = err.response?.headers ?? {};
      const body = err.response?.data ?? {};
      // Meta error shape
      const metaErr = body?.error ?? {};
      const detail = {
        http_status: status,
        fbtrace_id: metaErr.fbtrace_id || headers['x-fb-trace-id'],
        type: metaErr.type,
        code: metaErr.code,
        error_subcode: metaErr.error_subcode,
        message: metaErr.message,
        error_user_title: metaErr.error_user_title,
        error_user_msg: metaErr.error_user_msg,
      };

      console.log(detail, metaErr)

      // Example: handle some known cases programmatically
      // if (metaErr.error_subcode === 3835016) {
      // // WABA restricted from creating templates
      // // -> show friendly msg or guide to appeal
      //     return {
      //         status: false,
      //         message: 'WABA restricted from creating templates',
      //         details: detail
      //     };
      // }
      // if (metaErr.error_subcode === 2388024) {
      // // WABA restricted from creating templates
      // // -> show friendly msg or guide to appeal
      //     return {
      //         status: false,
      //         message: 'Content in this language already exists',
      //         details: detail
      //     };
      // }
    } else {
      console.error('Non-Axios error:', err);
    }
    return {
      status: false,
      message: 'Something went wrong',
      details: null,
    };
  }
}
/* send message methods end */


/* method utilities helper */
export const timeConverter = (timestamp: number) => {
  // Convert to milliseconds (JS uses ms, Unix timestamp is in seconds)
  const date = new Date(timestamp * 1000);

  // Example: format nicely (YYYY-MM-DD HH:mm:ss)
  const formatted = date.getFullYear() + "-" +
    String(date.getMonth() + 1).padStart(2, '0') + "-" +
    String(date.getDate()).padStart(2, '0') + " " +
    String(date.getHours()).padStart(2, '0') + ":" +
    String(date.getMinutes()).padStart(2, '0') + ":" +
    String(date.getSeconds()).padStart(2, '0');
  return formatted;
}

export const getDateDifference = (inputDateStr: string) => {
  // Convert to Date object
  let inputDate: string | Date = ""
  if (typeof inputDateStr === 'string') {
    inputDate = new Date(inputDateStr.replace(" ", "T"));
  }
  else {
    inputDate = new Date(inputDateStr);
  }
  // Get today's date
  const today = new Date();

  // Difference in milliseconds ( use getTime())
  const diffMs = inputDate.getTime() - today.getTime();

  // Convert differences
  // const diffSeconds = Math.floor(diffMs / 1000);
  // const diffMinutes = Math.floor(diffMs / (1000 * 60));
  // const diffHours   = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

export const addTimeToCurrent = (timestamp: number) => {
  // Current date
  const now = new Date();
  // Future date = now + duration
  const futureDate = new Date(now.getTime() + timestamp * 1000);

  // Nicely formatted (YYYY-MM-DD HH:mm:ss)
  const formatted = futureDate.getFullYear() + "-" +
    String(futureDate.getMonth() + 1).padStart(2, '0') + "-" +
    String(futureDate.getDate()).padStart(2, '0') + " " +
    String(futureDate.getHours()).padStart(2, '0') + ":" +
    String(futureDate.getMinutes()).padStart(2, '0') + ":" +
    String(futureDate.getSeconds()).padStart(2, '0');
  return formatted;
}


/* whats app cloud api */
export const getBusinessProfileDataById = async (id: string, token: string) => {
  try {
    const businessData = await axios.get(
      `https://graph.facebook.com/${GRAPH_VERSION}/${id}?fields=id,name,timezone_id`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      }
    );
    return businessData.data as { id: string; name: string };
  }
  catch (e) {
    console.log("getBusinessProfileDataById", e);
    return null;
  }
}
export const getWabaDataById = async (id: string, token: string) => {
  try {
    const wabaData = await axios.get(
      `https://graph.facebook.com/${GRAPH_VERSION}/${id}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      }
    );
    return wabaData.data as { id: string; name: string };
  }
  catch (e) {
    console.log("getWabaDataById", e);
    return null;
  }
}
export const getWabaNumberById = async (id: string, token: string) => {
  try {
    const numberData = await axios.get(
      `https://graph.facebook.com/${GRAPH_VERSION}/${id}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      }
    );
    return numberData.data as {
      "verified_name": string;
      "code_verification_status": CodeVerificationStatus;
      "display_phone_number": string;
      "quality_rating": NumberQualityRating;
      "id": string
    };
  }
  catch (e) {
    console.log("getWabaNumberById", e);
    return null;
  }
}
export const subscribeWabaApp = async (wabaId: string, token: string) => {
  const res = await axios.post(
    `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/subscribed_apps`,
    null,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
    }
  )
  if (res.status === HttpStatusCode.Ok) {
    return res.data.success;
  }
  return false;
}
export const unsubscribeWabaApp = async (wabaId: string, token: string) => {
  const res = await axios.delete(
    `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/subscribed_apps`,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
    }
  )
  if (res.status === HttpStatusCode.Ok) {
    return res.data.success;
  }
  return false;
}
export const registerPhoneNumber = async (numberId: string, token: string, pin: string = "000000") => {
  const res = await axios.post(
    `https://graph.facebook.com/${GRAPH_VERSION}/${numberId}/register`,
    JSON.stringify({
      "messaging_product": "whatsapp",
      "pin": pin
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
    }
  )
  if (res.status === HttpStatusCode.Ok) {
    return res.data.success;
  }
  return false;
}
export const deregisterPhoneNumber = async (numberId: string, token: string) => {
  const res = await axios.post(
    `https://graph.facebook.com/${GRAPH_VERSION}/${numberId}/deregister`,
    null,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
    }
  )
  if (res.status === HttpStatusCode.Ok) {
    return res.data.success;
  }
  return false;
}
export const phoneNumberRequestCode = async (numberId: string, token: string, type: "VOICE" | "SMS" = "SMS") => {
  const res = await axios.post(
    `https://graph.facebook.com/${GRAPH_VERSION}/${numberId}/request_code`,
    JSON.stringify({
      "code_method": type,
      "locale": "en_US",
      "language": "en_US",
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      params: {
        "code_method": type,
        "locale": "en_US"
      }
    }
  )
  if (res.status === HttpStatusCode.Ok) {
    return res.data.success;
  }
  return false;
}
export const phoneNumberVerifyCode = async (numberId: string, token: string, code: string) => {
  const res = await axios.post(
    `https://graph.facebook.com/${GRAPH_VERSION}/${numberId}/verify_code`,
    JSON.stringify({
      "code": code
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      params: {
        "code": code
      }
    }
  )
  if (res.status === HttpStatusCode.Ok) {
    return res.data.success;
  }
  return false;
}
export const setNewPinPhoneNumber = async (numberId: string, token: string, pin: string = "000000") => {
  const res = await axios.post(
    `https://graph.facebook.com/${GRAPH_VERSION}/${numberId}`,
    JSON.stringify({
      "pin": pin
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      params: {
        "pin": pin
      }
    }
  )
  if (res.status === HttpStatusCode.Ok) {
    return res.data.success;
  }
  return false;
}
export const deleteMessageTemplate = async (args: {
  wabaId: string;
  token: string;
  templateId: string;
  templateName: string;
}) => {
  try {
    const res = await axios.delete(
      `https://graph.facebook.com/${GRAPH_VERSION}/${args.wabaId}/message_templates`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + args.token
        },
        params: {
          "hsm_id": args.templateId,
          "name": args.templateName,
        }
      }
    )
    if (res.status === HttpStatusCode.Ok) {
      return res.data.success;
    }
    return false;
  }
  catch (e) {
    console.log("-----------deleteMessageTemplate----------", JSON.stringify(e))
    return false;
  }
}
export const updateMessageTemplate = async (args: {
  token: string;
  data: any;
  templateId: string;
}) => {
  try {
    const res = await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${args.templateId}`,
      JSON.stringify({ ...args.data, parameter_format: 'NAMED' }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + args.token
        }
      }
    );
    if (res.status === HttpStatusCode.Ok) {
      return {
        status: true,
        data: res.data
      }
    }
    return {
      status: false,
      message: 'Something went wrong !'
    };
  }
  catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const headers = err.response?.headers ?? {};
      const body = err.response?.data ?? {};
      // Meta error shape
      const metaErr = body?.error ?? {};
      const detail = {
        http_status: status,
        fbtrace_id: metaErr.fbtrace_id || headers['x-fb-trace-id'],
        type: metaErr.type,
        code: metaErr.code,
        error_subcode: metaErr.error_subcode,
        message: metaErr.message,
        error_user_title: metaErr.error_user_title,
        error_user_msg: metaErr.error_user_msg,
      };

      // Example: handle some known cases programmatically
      if (metaErr.error_subcode === 3835016) {
        // WABA restricted from creating templates
        // -> show friendly msg or guide to appeal
        return {
          status: false,
          message: 'WABA restricted from creating templates',
          details: detail
        };
      }
      if (metaErr.error_subcode === 2388024) {
        // WABA restricted from creating templates
        // -> show friendly msg or guide to appeal
        return {
          status: false,
          message: 'Content in this language already exists',
          details: detail
        };
      }
    } else {
      console.error('Non-Axios error:', err);
    }
    return {
      status: false,
      message: 'Something went wrong',
      details: null,
    };
  }
}

export const createWhatsAppMessageTemplate = async (requestPayload: TemplateCreationDto, gatewayAuth: GatewayAuth) => {
  const BASE_URL = 'https://content.twilio.com/v1/Content';

  try {
    const response = await axios.post(BASE_URL, requestPayload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${gatewayAuth.authKey}:${gatewayAuth.authToken}`).toString('base64')}`,
      },
    });

    if (response.status >= 200 && response.status < 300) {
      const data = {
        ...response.data,
        success: true,
        status: response.status
      }
      return data;
    }

    const data = {
      success: false,
      status: response.status,
      errorMessage: `Failed to create WhatsApp message template:` + response.data.message
    }
    return data;
  } catch (error) {
    console.error('Error creating WhatsApp message template:', error.status);
    if (axios.isAxiosError(error)) {
      console.log("errorResponse: ", error.response.data);
      return {
        status: error.status,
        success: false,
        errorMessage: `Failed to create WhatsApp message template: ${error.response?.data?.message || error.message}`,
      };
    }
  }
};

import {
  GOOGLE_DRIVE_FILE_BASE_URL,
  GOOGLE_DRIVE_THUMBNAIL_BASE_URL,
  STORAGE_TYPE__GOOGLE_DRIVE,
  STORAGE_TYPE_S3
} from "@/config/constant";
// import { ChangeLogDTO } from "@/modules/user-activity-logs/dto/add-activity-logs.dto";
import crypto, { randomUUID } from "crypto";
import fs from "fs";
import * as Handlebars from "handlebars";
import path from "path";
import { v4 as uuidv4 } from "uuid";

function checkBin(n) {
  return /^[01]{1,64}$/.test(n);
}
function checkDec(n) {
  return /^[0-9]{1,64}$/.test(n);
}
function checkHex(n) {
  return /^[0-9A-Fa-f]{1,64}$/.test(n);
}
function pad(s, z) {
  s = "" + s;
  return s.length < z ? pad("0" + s, z) : s;
}
function unpad(s) {
  s = "" + s;
  return s.replace(/^0+/, "");
}

export function Bin2Hex(n) {
  if (!checkBin(n)) return 0;
  return parseInt(n, 2).toString(16);
}

export function Hex2Bin(n) {
  if (!checkHex(n)) return 0;
  return parseInt(n, 16).toString(2);
}

export const generateUid = () => {
  const uid = uuidv4();
  const binaryUid = Buffer.from(uid.replace(/-/g, ""), "hex"); // Convert UUID string to a Buffer
  return binaryUid;
};

export const hex2Uid = (uid: string) => {
  const binaryUid = Buffer.from(uid.replace(/-/g, ""), "hex"); // Convert UUID string to a Buffer
  return binaryUid;
};

export const getFileIdFromDriveLink = (driveLink) => {
  try {
    const fileIdRegex = /\/file\/d\/([^/]+)/;
    const match = driveLink.match(fileIdRegex);
    if (match && match[1]) {
      return match[1];
    } else {
      console.log("Invalid Google Drive link:", driveLink);
      return null;
    }
  } catch (error) {
    console.error("Error extracting file ID from Google Drive link:", error);
    return false;
  }
};

export const generateKey = () => {
  // Generate a timestamp
  const timestamp = Date.now().toString(36);
  // Generate a random string
  const randomString = Math.random().toString(36).substr(2, 10);
  // Concatenate timestamp and random string to ensure uniqueness
  const key = timestamp + randomString;
  return key;
};

export function hideEmailChars(email) {
  if (!email) return "Unknown";
  // Split email address into local and domain parts
  const [localPart, domainPart = "Unknown"] = email.split("@");

  // Determine the number of asterisks to display, with a maximum of 3
  const numAsterisks = Math.min(localPart.length - 2, 3);

  // Construct the hidden local part
  let hiddenLocalPart;
  if (localPart.length <= 2) {
    hiddenLocalPart = localPart.charAt(0) + "**";
  } else {
    hiddenLocalPart =
      localPart.charAt(0) + "*".repeat(numAsterisks) + localPart.slice(-1);
  }

  // Return the modified email address
  return hiddenLocalPart + "@" + domainPart;
}

export const generateRandomApiKey = () => {
  const length = Math.floor(Math.random() * 6) + 20; // Random length between 20 and 25
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let apiKey = "";

  // Generate random string with the desired length
  for (let i = 0; i < length; i++) {
    apiKey += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return apiKey;
};

export const generateRandomKey = (length: number) => {
  // const length = Math.floor(Math.random() * 6) + 20; // Random length between 20 and 25
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const charactersLength = characters.length;
  let apiKey = "";

  // Generate random string with the desired length
  for (let i = 0; i < length; i++) {
    apiKey += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return apiKey;
};
export const delayInMinutes = (minutes: number) => {
  const currentTime = new Date();
  const fiveMinutesAgo = new Date(currentTime.getTime() - minutes * 60 * 1000);
  return fiveMinutesAgo.toISOString();
};

export const getFileUrl = (
  url,
  media_type,
  storage_type = STORAGE_TYPE__GOOGLE_DRIVE
) => {
  if (storage_type === STORAGE_TYPE_S3) {
    return url;
  }

  if (storage_type === STORAGE_TYPE__GOOGLE_DRIVE) {
    const fileId = getFileIdFromDriveLink(url);
    if (media_type === "VIDEO") {
      return `${GOOGLE_DRIVE_FILE_BASE_URL}${fileId}`;
    }
    return `${GOOGLE_DRIVE_THUMBNAIL_BASE_URL}${fileId}`;
  } else url;
};

export const constructIntegrationState = (
  key: string,
  isCustomDomain: boolean = false
) => {
  return isCustomDomain ? key + "customdomain" : key;
};

export const destructIntegrationstate = (state: string) => {
  const apiKey = state.split("customdomain")[0];
  return {
    apiKey,
    isCustomDomain: state.length > apiKey.length
  };
};

export function encryptObject(
  obj,
  key = process.env.ENCRYPT_DATA_KEY || "097794eb86393857eef2201e2873d410"
) {
  if (key.length !== 32) {
    throw new Error(
      "Invalid key length. Key must be 32 bytes long for AES-256-CBC."
    );
  }
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(key),
    Buffer.alloc(16)
  );
  let encrypted = cipher.update(JSON.stringify(obj), "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

export function decryptObject(
  encrypted,
  key = process.env.ENCRYPT_DATA_KEY || "097794eb86393857eef2201e2873d410"
) {
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(key),
      Buffer.alloc(16)
    );
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted);
  } catch (error) {
    console.log(error.message);
    return null;
  }
}

// export function findChanges(oldObject, newObj, parentKey = ""): ChangeLogDTO[] {
//   const changes = [];

//   try {
//     const allKeys = new Set([
//       ...Object.keys(oldObject),
//       ...Object.keys(newObj)
//     ]);

//     allKeys.forEach((key) => {
//       const value1 = oldObject[key];
//       const value2 = newObj[key];
//       const fullKey = parentKey ? `${parentKey}.${key}` : key;
//       if (value2) {
//         if (
//           typeof value1 === "object" &&
//           typeof value2 === "object" &&
//           !Array.isArray(value1) &&
//           !Array.isArray(value2)
//         ) {
//           const nestedChanges = findChanges(value1, value2, fullKey);
//           changes.push(...nestedChanges);
//         } else if (Array.isArray(value1) && Array.isArray(value2)) {
//           if (JSON.stringify(value1) !== JSON.stringify(value2)) {
//             changes.push({
//               fieldName: fullKey,
//               oldValue: value1,
//               newValue: value2
//             });
//           }
//         } else if (value1 !== value2) {
//           changes.push({
//             fieldName: fullKey,
//             oldValue: value1,
//             newValue: value2
//           });
//         }
//       }
//     });

//     return changes;
//   } catch (error) {
//     return [];
//   }
// }

export function generateNumber() {
  const uniqueId = Math.floor(Math.random() * 90000) + 10000; // Generate a random 5-digit number
  const invoiceNumber = `${uniqueId}`;
  return invoiceNumber;
}

export function getFileDownloadPath(
  uploadFilename: string,
  isImage: Boolean = false
): string {
  const folderPath = "./media";
  const ext = path.extname(uploadFilename) || isImage ? ".jpeg" : ".mp4";

  const cleanedExt = ext.startsWith(".") ? ext.slice(1) : ext;

  const filename = `${randomUUID()}.${cleanedExt}`;
  const tempFilePath = path.join(folderPath, filename);

  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
  } catch (error) {
    throw new Error(
      `Failed to create directory ${folderPath}: ${error.message}`
    );
  }

  return tempFilePath;
}

export function validateHandlebarsTemplate(template): {
  isValid: boolean;
  message: string;
} {
  try {
    const parsedTemplate = Handlebars.parse(template);
    return { isValid: true, message: "Valid template" };
  } catch (error) {
    return { isValid: false, message: error.message };
  }
}

// Convert permission value to array of bitwise numbers
export function convertToBitwiseArray(value: number): number[] {
  const bitwiseArray: number[] = [];
  let bit = 1;

  while (value > 0) {
    if (value & bit) {
      bitwiseArray.push(bit);
    }
    value = value & ~bit;
    bit = bit << 1;
  }

  return bitwiseArray;
}

export const getViewThumbnailDrive = (id: string) => {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
};
//https://drive.google.com/file/d/1t3al7vPIQrCh3oeHFhk0gy5RNRukYxki/preview

export const getViewPreviewDrive = (id: string) => {
  return `https://drive.google.com/file/d/${id}/preview`;
};

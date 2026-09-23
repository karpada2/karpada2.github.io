import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "",

  authDomain: "iasa-kiosk-temp.firebaseapp.com",

  databaseURL: "https://iasa-kiosk-temp-default-rtdb.europe-west1.firebasedatabase.app",

  projectId: "iasa-kiosk-temp",

  storageBucket: "iasa-kiosk-temp.firebasestorage.app",

  messagingSenderId: "337110030623",

  appId: "1:337110030623:web:0c20c0fcddaa950d27782a"

};

export var firebaseApp
export var firebaseDatabase
export var firebaseAuthentication


const firebaseEncryptedApiKey = "F3ssR1AjwtOV3MLEwEaKXI+x8dhTLBG2P4Rajo6KqtEk+xGCBWOkEThOaCi5lEWKNdR6mRKle2l7MtBDCW61n43nYJw8mtvfU9ihU04PsgbxG1g="
const firebaseAdminEncryptedApiKey = "A6jMgX6vMiN6WExH67qiaJzy9hwtJRPbEPOM4FZZwoqmO/bCHh/RNAf10NsJqxG4UEak/qwntaCpE7oywn8YPd/ZFCF96IShPVPIH24jBtGJs5o="
const passwordHash = "b7b740f4a0a1ff37e44086f74949b6b3cc6b81431669e33c9b68e66428099b4c"
const adminPasswordHash = "a3eff3d2332a6be2802e7cf6f4dd6454a8e42270c5ef6251a5eb7cf3f1004c97"


export async function SHA_256(password) {
    const msgUint8 = new TextEncoder().encode(password);      // 1. Encode to bytes
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8); // 2. Hash it
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // 3. Convert to array
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // 4. Hex string
    return hashHex;
}

export function base64ToUint8Array(base64String) {
    // This adds the correct number of '=' characters (0, 1, or 2) 
    // to satisfy atob's strict length-multiple-of-4 requirement.
    const padded = base64String.padEnd(base64String.length + (4 - base64String.length % 4) % 4, '=');
    const binaryString = atob(padded);
    return Uint8Array.from(binaryString, (char) => char.charCodeAt(0));
}

const ITERATIONS = 100_000;
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

async function decryptApiKey(password, encryptedKey, tagLengthIn = TAG_LENGTH, ivLengthIn = IV_LENGTH, keyLengthIn = KEY_LENGTH, iterationsIn = ITERATIONS) {
    var data = base64ToUint8Array(encryptedKey)

    var salt, iv, encrypted

    salt = data.slice(0, tagLengthIn)
    iv = data.slice(tagLengthIn, tagLengthIn + ivLengthIn)
    encrypted = data.slice(tagLengthIn + ivLengthIn, data.length)

    const passwordBuffer = new TextEncoder().encode(password)

    const passwordKey = await crypto.subtle.importKey(
        "raw",
        passwordBuffer,
        "PBKDF2",
        false,
        ["deriveKey"]
    )

    const derivedKey = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: iterationsIn,
            hash: "SHA-256"
        },
        passwordKey,
        {
            name: "AES-GCM",
            length: keyLengthIn
        },
        false,
        ["decrypt"]
    )

    const decrypted = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        derivedKey,
        encrypted
    )

    return new TextDecoder().decode(decrypted)
}

export async function attemptUpdateFirebaseApiKey(givenPassword) {
    if (await SHA_256(givenPassword) == passwordHash) {
        firebaseConfig.apiKey = await decryptApiKey(givenPassword, firebaseEncryptedApiKey)
        return true
    }
    else if (await SHA_256(givenPassword) == adminPasswordHash) {
        firebaseConfig.apiKey = await decryptApiKey(givenPassword, firebaseAdminEncryptedApiKey)
        return true
    }
    return false
}

export function updateFirebaseReferences() {
    firebaseApp = initializeApp(firebaseConfig)
    firebaseDatabase = getFirestore(firebaseApp)
    firebaseAuthentication = getAuth(firebaseApp)
}

// Function triggered by the user entering a password
export async function authenticateWithPassword(passwordInput) {
  try {
    // Attempt to authenticate as Admin first
    const userCredential = await signInWithEmailAndPassword(firebaseAuthentication, "admin@internal.local", passwordInput);
    console.log("Authenticated with Admin access. UID:", userCredential.user.uid);
    return "admin";
  } catch (adminError) {
    try {
      // If Admin authentication fails, attempt as Basic
      const userCredential = await signInWithEmailAndPassword(firebaseAuthentication, "basic@internal.local", passwordInput);
      console.log("Authenticated with Basic access. UID:", userCredential.user.uid);
      return "basic";
    } catch (basicError) {
      console.error("Authentication failed: Invalid password.");
      throw new Error("Invalid password");
    }
  }
}

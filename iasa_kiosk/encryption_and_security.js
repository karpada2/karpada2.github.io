import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import * as databaseHandler from "./database_handling.js"


export const webPageData = {
    "sensitive_changes.html": {
        "access": ["admin"],
        "enabled": true,
        "displayName": "שינוי נתונים רגישים"
    },
    "customers_manager.html": {
        "access": ["admin"],
        "enabled": true,
        "displayName": "מנהל לקוחות"
    },
    "items_manager.html": {
        "access": ["admin"],
        "enabled": true,
        "displayName": "מנהל מוצרים"
    },
    "homepage.html": {
        "access": ["admin", "basic"],
        "enabled": false,
        "displayName": "מסך בית"
    },
    "purchases_logger.html": {
        "access": ["admin", "basic"],
        "enabled": true,
        "displayName": "רושם קניות"
    },
    "debt_payments.html": {
        "access": ["admin", "basic"],
        "enabled": true,
        "displayName": "תשלום חובות"
    },
    "debt_checker.html": {
        "access": ["admin", "basic"],
        "enabled": true,
        "displayName": "בדיקת חובות"
    },
}


export const firebaseConfig = {
  apiKey: "AIzaSyBfC4brPJTAZzndxPmgt4PMRns2emjR71Y",

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

export function isPageAccessible(pageInput, accessLevel) {
    const page = pageInput.split('/').pop()
    return webPageData[[page]]["enabled"] && webPageData[[page]]["access"].includes(accessLevel)
}

export async function attemptLogIn(password, names) {
    await updateFirebaseReferences()
    var authenticated = await authenticateWithPassword(password);
    var success = authenticated != "invalid"
    document.getElementById("logInSuccessIndicator").textContent = success ? "Logging In!" : "WRONG PASSWORD"
    if (success) {
        databaseHandler.updateVariables(authenticated, names)
        var locationToSend = "./homepage.html"
        if (sessionStorage.getItem("wantedLocation") != null) {
            if (isPageAccessible(sessionStorage.getItem("wantedLocation"), authenticated)) {
                locationToSend = sessionStorage.getItem("wantedLocation")
            }
        }
        location.href = locationToSend
    }
}

export function updateFirebaseReferences() {
    firebaseApp = initializeApp(firebaseConfig)
    firebaseDatabase = initializeFirestore(
        firebaseApp, 
        {
            localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
        }
    );
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
      return "invalid";
    }
  }
}

export async function setBasicPassword(newPassword) {
  const token = await firebaseAuthentication.currentUser.getIdToken();
  const res = await fetch("https://pw-worker.iasa-kiosk-password-manager.workers.dev", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ newPassword }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
}

export async function setAdminPassword(currentPassword, newPassword) {
    const user = getAuth().currentUser;
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred); // avoids auth/requires-recent-login
    await updatePassword(user, newPassword);
}

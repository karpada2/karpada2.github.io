import * as encryption from "./encryption_and_security.js"
import * as firestore from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

export var firebaseDatabase
export var firebaseAuthentication
export var accessLevel 
const currentYear = "36"


export function updateVariables(accessLevel, apiKey, sellers) {
    sessionStorage.setItem("accessLevel", accessLevel)
    sessionStorage.setItem("firebaseApiKey", apiKey)
    sessionStorage.setItem("sellersNames", sellers)
}

export async function init() {
    encryption.firebaseConfig.apiKey = sessionStorage.getItem("firebaseApiKey")
    await encryption.updateFirebaseReferences()
    firebaseDatabase = encryption.firebaseDatabase
    firebaseAuthentication = encryption.firebaseAuthentication
    accessLevel = sessionStorage.getItem("accessLevel") // set once, at login, not re-derived every page
}

// export function convertDatabaseDataToIntended(input) {
//     return input.replace(/\{(\d+)\}/g, (_, asciiCode) => {
//         return String.fromCharCode(Number(asciiCode));
//     });
// }


// export function sanitizeDatabaseInput(input) {
//     const specialChars = {
//         '.': `{${'.'.charCodeAt(0)}}`,
//         '#': `{${'#'.charCodeAt(0)}}`,
//         '$': `{${'$'.charCodeAt(0)}}`,
//         '[': `{${'['.charCodeAt(0)}}`,
//         ']': `{${']'.charCodeAt(0)}}`
//     };
//     return input.replace(/[.#$\[\]]/g, char => specialChars[char]);
// }

export async function getAllItems() {
    const querySnapshot = await firestore.getDocs(
        firestore.query(firestore.collection(firebaseDatabase, "ITEMS"), firestore.orderBy("ADDED_TIMESTAMP"))
    );

    const resultingArray = await Promise.all(
        querySnapshot.docs.map(async (doc) => {
            const priceHistorySnapshot = await firestore.getDocs(
                firestore.collection(firebaseDatabase, "ITEMS", doc.id, "PRICE_HISTORY")
            );

            const tempArray = priceHistorySnapshot.docs.map((phDoc) => ({
                UUID: phDoc.id,
                data: phDoc.data(),
            }));

            return {
                UUID: doc.id,
                data: doc.data(),
                price_history: tempArray,
            };
        })
    );

    return resultingArray;
}

export async function updateItems(originalItems, newItems) {
    await newItems.forEach(async (newItem, index) => {
        const itemRef = firestore.doc(firebaseDatabase, "ITEMS", newItem.UUID)
        if (index < originalItems.length) {
            var oldItem = originalItems[index]
            var changes = {}

            var anyChanges = false
            var addPriceHistory = false

            if (oldItem["data"]["NAMES"] != newItem["data"]["NAMES"]) {
                changes["NAMES"] = newItem["data"]["NAMES"]
                anyChanges = true
            }
            if (oldItem["data"]["IS_ACTIVE"] != newItem["data"]["IS_ACTIVE"]) {
                changes["IS_ACTIVE"] = newItem["data"]["IS_ACTIVE"]
                anyChanges = true
            }
            if (oldItem["data"]["CURRENT_PRICE"] != newItem["data"]["CURRENT_PRICE"]) {
                addPriceHistory = true
                changes["CURRENT_PRICE"] = newItem["data"]["CURRENT_PRICE"]
                anyChanges = true
            }

            if (anyChanges) {
                await firestore.updateDoc(itemRef, changes)
            }

            if (addPriceHistory) {
                await firestore.setDoc(firestore.doc(firebaseDatabase, "ITEMS", newItem.UUID, "PRICE_HISTORY", crypto.randomUUID()), {"TIMESTAMP" : Math.floor(Date.now() / 1000), "PRICE" : newItem["data"]["CURRENT_PRICE"]})
            }
        }
        else {
            await firestore.setDoc(itemRef, newItem["data"])
            await firestore.setDoc(firestore.doc(firebaseDatabase, "ITEMS", newItem.UUID, "PRICE_HISTORY", crypto.randomUUID()), {"TIMESTAMP" : Math.floor(Date.now() / 1000), "PRICE" : newItem["data"]["CURRENT_PRICE"]})
        }
    });
}

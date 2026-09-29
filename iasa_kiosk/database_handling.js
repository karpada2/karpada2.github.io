import * as encryption from "./encryption_and_security.js"
import * as firestore from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

export var firebaseDatabase
export var firebaseAuthentication
export var accessLevel 

export function updateVariables(accessLevel, apiKey, sellers) {
    sessionStorage.setItem("accessLevel", accessLevel)
    sessionStorage.setItem("firebaseApiKey", apiKey)
    sessionStorage.setItem("sellersNames", sellers)
}

export async function init() {
    const tempApiKey = sessionStorage.getItem("firebaseApiKey")
    if (tempApiKey != null) {
        encryption.firebaseConfig.apiKey = sessionStorage.getItem("firebaseApiKey")
        await encryption.updateFirebaseReferences()
        firebaseDatabase = encryption.firebaseDatabase
        firebaseAuthentication = encryption.firebaseAuthentication
        accessLevel = sessionStorage.getItem("accessLevel") // set once, at login, not re-derived every page
    }
    else {
        sessionStorage.setItem("wantedLocation", location.href)
        location.href="./login.html"
    }
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

export async function getAllItems(alsoPriceHistory = false) {
    const querySnapshot = await firestore.getDocs(
        firestore.query(firestore.collection(firebaseDatabase, "ITEMS"), firestore.orderBy("ADDED_TIMESTAMP"))
    );

    const resultingArray = await Promise.all(
        querySnapshot.docs.map(async (doc) => {
            if (alsoPriceHistory) {
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
            }
            else {
                return {
                    UUID: doc.id,
                    data: doc.data()
                };
            }
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


// returns a map containing the customers as pure data, and also the names as a map to the UUID, for fuzzy search
export async function getCustomersFromGrades(grades) {
    var orStatement = firestore.where("GRADE", "==", "N/A")
    for (var i = 0; i < grades.length; i++) {
        orStatement = firestore.or(orStatement, firestore.where("GRADE", "==", String(grades[i])))
    }
    const querySnapshot = await firestore.getDocs(
        firestore.query(firestore.collection(firebaseDatabase, "CUSTOMERS"), orStatement, firestore.orderBy("GRADE"))
    );

    const nameUUIDMap = {}
    const resultingArray = []

    querySnapshot.forEach((doc) => {
        resultingArray.push({
            UUID: doc.id,
            data: doc.data()
        })
        nameUUIDMap[[doc.data()["NAME"]]] = doc.id
    })

    return {
        names: nameUUIDMap,
        full_data: resultingArray
    };
}

export async function updateCustomers(originalCustomers, newCustomers) {
    await newCustomers.forEach(async (newCustomer, index) => {
        const customerRef = firestore.doc(firebaseDatabase, "CUSTOMERS", newCustomer.UUID)
        if (index < originalCustomers.length) {
            var oldCustomer = originalCustomers[index]
            var changes = {}

            var anyChanges = false

            if (oldCustomer["data"]["NAME"] != newCustomer["data"]["NAME"]) {
                changes["NAME"] = newCustomer["data"]["NAME"]
                anyChanges = true
            }
            if (oldCustomer["data"]["CURRENT_DEBT"] != newCustomer["data"]["CURRENT_DEBT"]) {
                changes["CURRENT_DEBT"] = newCustomer["data"]["CURRENT_DEBT"]
                anyChanges = true
            }
            if (oldCustomer["data"]["CUSTOMER_TYPE"] != newCustomer["data"]["CUSTOMER_TYPE"]) {
                changes["CUSTOMER_TYPE"] = newCustomer["data"]["CUSTOMER_TYPE"]
                anyChanges = true
            }
            if (oldCustomer["data"]["PHONE_NUMBER"] != newCustomer["data"]["PHONE_NUMBER"]) {
                changes["PHONE_NUMBER"] = newCustomer["data"]["PHONE_NUMBER"]
                anyChanges = true
            }
            if (oldCustomer["data"]["ROOM_NUMBER"] != newCustomer["data"]["ROOM_NUMBER"]) {
                changes["ROOM_NUMBER"] = newCustomer["data"]["ROOM_NUMBER"]
                anyChanges = true
            }

            if (Object.hasOwn(changes, "CUSTOMER_TYPE")) {
                if (changes["CUSTOMER_TYPE"] != "פנימיסט") {
                    changes["ROOM_NUMBER"] = "N/A"
                }
                if (changes["CUSTOMER_TYPE"] == "צוות") {
                    changes["GRADE"] = "N/A"
                }
            }

            if (anyChanges) {
                await firestore.updateDoc(customerRef, changes)
            }
        }
        else {
            if (newCustomer["data"]["CUSTOMER_TYPE"] != "פנימיסט") {
                newCustomer["data"]["ROOM_NUMBER"] = "N/A"
            }
            if (newCustomer["data"]["CUSTOMER_TYPE"] == "צוות") {
                newCustomer["data"]["GRADE"] = "N/A"
            }
            await firestore.setDoc(customerRef, newCustomer["data"])
        }
    });
}

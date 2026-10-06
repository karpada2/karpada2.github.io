import * as encryption from "./encryption_and_security.js"
import * as firestore from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import * as globals from "./global_variables.js"
import * as XLSX from "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm";
import { setInfo } from "./global_variables.js"

export var firebaseDatabase
export var firebaseAuthentication
export var accessLevel 

export function updateVariables(accessLevel, sellers) {
    sessionStorage.setItem("accessLevel", accessLevel)
    sessionStorage.setItem("sellersNames", sellers)
}

export async function init() {
    const tempAccess = sessionStorage.getItem("accessLevel")
    if (tempAccess != null) {
        await encryption.updateFirebaseReferences()
        firebaseDatabase = encryption.firebaseDatabase
        firebaseAuthentication = encryption.firebaseAuthentication
        accessLevel = tempAccess // set once, at login, not re-derived every page
        setInfo(await getGradesInfo())
        if (location.href.split('/').pop() != "homepage.html") {
            if (!encryption.isPageAccessible(location.href, accessLevel)) {
                location.href="./homepage.html"
            }
            else if (sessionStorage.getItem("wantedLocation") != null && location.href.split('/').pop() != sessionStorage.getItem("wantedLocation").split('/').pop()) {
                location.href = sessionStorage.getItem("wantedLocation")
                sessionStorage.removeItem("wantedLocation")
            }
        }
    }
    else {
        sessionStorage.setItem("wantedLocation", location.href)
        location.href="./login.html"
    }
}

export function getCurrentTimestamp() {
    return Math.floor(Date.now() / 1000)
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
        firestore.query(firestore.collection(firebaseDatabase, "ITEMS"), firestore.where("ADDED_TIMESTAMP", "!=", 0), firestore.orderBy("ADDED_TIMESTAMP"))
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

export async function getItemsDataForPurchases() {
    const querySnapshot = await firestore.getDocs(
        firestore.query(firestore.collection(firebaseDatabase, "ITEMS"), firestore.where("IS_ACTIVE", "==", true), firestore.orderBy("ADDED_TIMESTAMP"))
    );

    var namesArray = []
    var uuidsArray = []
    var pricesArray = []

    querySnapshot.forEach((doc) => {
        namesArray.push(doc.data()["NAMES"])
        uuidsArray.push(doc.id)
        pricesArray.push(doc.data()["CURRENT_PRICE"])
    })

    return {
        names: namesArray,
        UUIDs: uuidsArray,
        prices: pricesArray,
    };
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
                await firestore.setDoc(firestore.doc(firebaseDatabase, "ITEMS", newItem.UUID, "PRICE_HISTORY", crypto.randomUUID()), {"TIMESTAMP" : getCurrentTimestamp(), "PRICE" : newItem["data"]["CURRENT_PRICE"]})
            }
        }
        else {
            await firestore.setDoc(itemRef, newItem["data"])
            await firestore.setDoc(firestore.doc(firebaseDatabase, "ITEMS", newItem.UUID, "PRICE_HISTORY", crypto.randomUUID()), {"TIMESTAMP" : getCurrentTimestamp(), "PRICE" : newItem["data"]["CURRENT_PRICE"]})
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

export async function getCustomersFromGradesOriginalData(grades) {
    var orStatement = firestore.where("GRADE", "==", "N/A")
    for (var i = 0; i < grades.length; i++) {
        orStatement = firestore.or(orStatement, firestore.where("GRADE", "==", String(grades[i])))
    }
    const querySnapshot = await firestore.getDocs(
        firestore.query(firestore.collection(firebaseDatabase, "CUSTOMERS"), orStatement, firestore.orderBy("GRADE"))
    );

    const resultingMap = {}

    querySnapshot.forEach((doc) => {
        resultingMap[[doc.id]] = doc.data()
    })

    return resultingMap
}

export async function getCustomersInRoom(roomNumber, grades, forceCache = true) {
    var orStatement = firestore.where("GRADE", "==", String(grades[0]))
    for (var i = 1; i < grades.length; i++) {
        orStatement = firestore.or(orStatement, firestore.where("GRADE", "==", String(grades[i])))
    }

    const q = firestore.query(
        firestore.collection(firebaseDatabase, "CUSTOMERS"),
        firestore.and(firestore.where("ROOM_NUMBER", "==", String(roomNumber)), orStatement)
    )
    const querySnapshot = forceCache
        ? await firestore.getDocsFromCache(q)
        : await firestore.getDocs(q)

    var resultingMap = {}

    querySnapshot.forEach((doc) => {
        resultingMap[doc.data()["NAME"]] = doc.data()["CURRENT_DEBT"][globals.getOperatingGrade()]
    })

    return resultingMap
}

export async function updateCustomers(originalCustomers, newCustomers) {
    await newCustomers.forEach(async (newCustomer, index) => {
        const customerRef = firestore.doc(firebaseDatabase, "CUSTOMERS", newCustomer.UUID)
        if (index < originalCustomers.length) {
            var oldCustomer = originalCustomers[index]
            var changes = {}

            var anyChanges = false
            var debtChange = false

            if (oldCustomer["data"]["NAME"] != newCustomer["data"]["NAME"]) {
                changes["NAME"] = newCustomer["data"]["NAME"]
                anyChanges = true
            }
            if (oldCustomer["data"]["CURRENT_DEBT"] != newCustomer["data"]["CURRENT_DEBT"]) {
                debtChange = true
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
            const diff = newCustomer["data"]["CURRENT_DEBT"][globals.getOperatingGrade()]
            if (diff != 0) {
                newCustomer["data"]["CURRENT_DEBT"][globals.getOperatingGrade()] = 0
            }
            await firestore.setDoc(customerRef, newCustomer["data"])

            if (diff > 0) { // means his debt grew, fake purchase should be logged
                await firestore.setDoc(firestore.doc(firebaseDatabase, "ITEMS", "FAKE_ITEM"), {"CURRENT_PRICE": diff})
                await firestore.setDoc(firestore.doc(firebaseDatabase, "ITEMS", "FAKE_ITEM", "PRICE_HISTORY", crypto.randomUUID()), {"PRICE": diff, "TIMESTAMP": getCurrentTimestamp()})
                await savePurchase(newCustomer.UUID, "FAKE_ITEM", 1, diff)
            }
            else if (diff < 0) { // means his debt shrank, fake payment should be logged
                await savePayment(newCustomer.UUID, -diff, false) // maybe false is bad idea, idc right now, this should only happen in the transition period (so only this year)
            }
        }
    });
}

export async function savePurchase(customerUUID, itemUUID, amount, totalPrice) {
    const purchaseRef = firestore.doc(firebaseDatabase, "CUSTOMERS", customerUUID, "PURCHASES", crypto.randomUUID())
    await firestore.setDoc(purchaseRef, {
        "AMOUNT": parseInt(amount),
        "ITEM": firestore.doc(firebaseDatabase, "ITEMS", itemUUID),
        "OPERATING_GRADE": globals.getOperatingGrade(),
        "PRICE": totalPrice,
        "SELLERS_NAMES": sessionStorage.getItem("sellersNames"),
        "TIMESTAMP": getCurrentTimestamp()
    })
    await modifyDebt(customerUUID, totalPrice)
    await firestore.updateDoc(
        firestore.doc(firebaseDatabase, "MONEY_INFO", "INFO"), {
            ["UNCLAIMED_DEBTS." + globals.getOperatingGrade()]: firestore.increment(totalPrice)
        }
    )
}

export async function savePayment(customerUUID, paymentSize, isMethodCash) {
    const paymentRef = firestore.doc(firebaseDatabase, "CUSTOMERS", customerUUID, "PAYMENTS", crypto.randomUUID())
    await firestore.setDoc(paymentRef, {
        "IS_METHOD_CASH": isMethodCash,
        "OPERATING_GRADE": globals.getOperatingGrade(),
        "PAYMENT_SIZE": paymentSize,
        "SELLERS_NAMES": sessionStorage.getItem("sellersNames"),
        "TIMESTAMP": getCurrentTimestamp()
    })
    await modifyDebt(customerUUID, -paymentSize)
    await firestore.updateDoc(
        firestore.doc(firebaseDatabase, "MONEY_INFO", "INFO"), {
            ["CLAIMED_REVENUE." + globals.getOperatingGrade()]: firestore.increment(paymentSize),
            ["UNCLAIMED_DEBTS." + globals.getOperatingGrade()]: firestore.increment(-paymentSize)
        }
    )
}

async function modifyDebt(customerUUID, modifyAmount) {
    const customerRef = firestore.doc(firebaseDatabase, "CUSTOMERS", customerUUID)
    await firestore.updateDoc(customerRef, {
        ["CURRENT_DEBT." + globals.getOperatingGrade()]: firestore.increment(modifyAmount)
    })
}

export function parseSheet(file) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                resolve(XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false }));
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

export async function getGradesInfo() {
    const ref = firestore.doc(firebaseDatabase, "OPERATION_INFO", "DATA")
    const snapshot = await firestore.getDoc(ref)

    return snapshot.data()
}

export async function setGradesInfo(info) {
    const ref = firestore.doc(firebaseDatabase, "OPERATION_INFO", "DATA")
    await firestore.updateDoc(ref, info)
}

export async function getRevenueInfo() {
    const ref = firestore.doc(firebaseDatabase, "MONEY_INFO", "INFO")
    const snapshot = await firestore.getDoc(ref)

    return {
        "CLAIMED": snapshot.data()["CLAIMED_REVENUE"][globals.getOperatingGrade()],
        "UNCLAIMED": snapshot.data()["UNCLAIMED_DEBTS"][globals.getOperatingGrade()]
    }
}

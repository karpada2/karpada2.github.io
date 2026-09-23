var firebaseDatabase
var firebaseAuthentication
var sellersName
var accessLevel
const currentYear = "36"


export function updateVariables(db, auth, sellers, access) {
    firebaseDatabase = db;
    firebaseAuthentication = auth;
    sellersName = sellers;
    accessLevel = access;
}

function convertDatabaseDataToIntended(input) {
    return input.replace(/\{(\d+)\}/g, (_, asciiCode) => {
        return String.fromCharCode(Number(asciiCode));
    });
}


function sanitizeDatabaseInput(input) {
    const specialChars = {
        '.': `{${'.'.charCodeAt(0)}}`,
        '#': `{${'#'.charCodeAt(0)}}`,
        '$': `{${'$'.charCodeAt(0)}}`,
        '[': `{${'['.charCodeAt(0)}}`,
        ']': `{${']'.charCodeAt(0)}}`
    };

    return input.replace(/[.#$\[\]]/g, char => specialChars[char]);
}



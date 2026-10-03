export function getOperatingGrade() {
    if (sessionStorage.getItem("operatingGrade") != null) {
        return sessionStorage.getItem("operatingGrade")
    }
    sessionStorage.setItem("operatingGrade", "36")
    return sessionStorage.getItem("operatingGrade")
}

export function getActiveGrades() {
    if (sessionStorage.getItem("activeGrades") != null) {
        return JSON.parse(sessionStorage.getItem("activeGrades"))
    }
    sessionStorage.setItem("activeGrades", "[\"36\", \"37\", \"38\"]")
    return JSON.parse(sessionStorage.getItem("activeGrades"))
}

export function getCustomerTypes() {
    return ["פנימיסט", "יומי", "צוות"]
}
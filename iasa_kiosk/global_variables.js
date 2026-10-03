var info = {}

// should only be called from database_handling
export function setInfo(newInfo) {
    info = newInfo
}

export function getOperatingGrade() {
    return info["OPERATING_GRADE"]
}

export function getActiveGrades() {
    return info["ACTIVE_GRADES"]
}

export function getCustomerTypes() {
    return ["פנימיסט", "יומי", "צוות"]
}
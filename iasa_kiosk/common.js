import * as encryption from "./encryption_and_security.js"

export function add_navigation_footer(accessLevel) {
    const footer = document.createElement("footer")
    footer.id = "navigation-footer"
    const buttonsDiv = document.createElement("div")
    buttonsDiv.id="navigation-container"
    buttonsDiv.className = "horizontalContainer"

    footer.appendChild(buttonsDiv)

    for (var i in Object.keys(encryption.webPageData)) {
        const page = Object.keys(encryption.webPageData)[i]
        if (encryption.isPageAccessible(page, accessLevel)) {
            const button = document.createElement("button")
            button.textContent = encryption.webPageData[[page]]["displayName"]
            button.addEventListener("click", () => {
                location.href = page
            })

            buttonsDiv.appendChild(button)
        }
    }

    document.body.appendChild(footer)
}
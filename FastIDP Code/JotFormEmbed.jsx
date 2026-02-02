import { useEffect, useRef } from "react"

export default function JotFormEmbed() {
    const containerRef = useRef(null)
    const scriptLoaded = useRef(false)

    useEffect(() => {
        // Check if form already exists in DOM (prevents reload loss)
        const existingForm = document.querySelector('[data-jotform-id="243186644258161"]')
        if (existingForm && containerRef.current) {
            // Form already loaded, don't reload it
            containerRef.current.innerHTML = ''
            containerRef.current.appendChild(existingForm)
            scriptLoaded.current = true
            return
        }

        // Don't load script multiple times
        if (scriptLoaded.current) return

        // Check if script already exists
        const existingScript = document.querySelector(
            'script[src*="form.jotform.com/jsform"]'
        )
        if (existingScript) {
            scriptLoaded.current = true
            return
        }

        // Add CSS to ensure JotForm can expand fully
        const style = document.createElement("style")
        style.textContent = `
            .jotform-form {
                width: 100% !important;
                max-width: 100% !important;
                min-height: auto !important;
                height: auto !important;
            }
            #jf-card-welcome-243186644258161,
            #stage {
                width: 100% !important;
                max-width: 100% !important;
                overflow: visible !important;
            }
        `
        document.head.appendChild(style)

        // Create and inject the JotForm script
        const script = document.createElement("script")
        script.type = "text/javascript"
        script.src = "https://form.jotform.com/jsform/243186644258161"
        script.async = true

        // Append script to container
        if (containerRef.current) {
            containerRef.current.appendChild(script)
            scriptLoaded.current = true
        }

        // Cleanup
        return () => {
            if (script.parentNode) {
                script.parentNode.removeChild(script)
            }
            if (style.parentNode) {
                style.parentNode.removeChild(style)
            }
            scriptLoaded.current = false
        }
    }, [])

    return (
        <div 
            ref={containerRef}
            style={{ 
                width: "100%",
                maxWidth: "100%",
                minHeight: "600px",
                overflow: "visible"
            }}
        />
    )
}

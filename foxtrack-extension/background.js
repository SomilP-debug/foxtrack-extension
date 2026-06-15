chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        const url = details.url.toLowerCase();

        // ONLY catch the direct Render PIXEL links, let the API pass
        if (url.includes('onrender.com/track/')) {
            console.log("FoxTrack Firewall: Blocked direct self-ping!");
            return { cancel: true };
        }

        // The Sent Folder Failsafe
        if (details.documentUrl && details.documentUrl.includes('#sent')) {
            if (url.includes('googleusercontent.com/proxy')) {
                console.log("FoxTrack Firewall: Killed Google Proxy ping inside Sent folder!");
                return { cancel: true };
            }
        }
    },
    { 
        urls: [
            "*://*.onrender.com/*", 
            "*://*.googleusercontent.com/*"
        ] 
    },
    ["blocking"]
);
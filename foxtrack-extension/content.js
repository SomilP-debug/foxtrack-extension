function generateId() {
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}


const NGROK_URL = 'https://foxtrack-email-tracking-firefox.onrender.com';

async function executeTrackingAndSend(composeWindow, realSendButton, cloneButton) {

   
    if (composeWindow.getAttribute('data-tracking-locked') === 'true') {
        return; 
    }
    // Lock the window
    composeWindow.setAttribute('data-tracking-locked', 'true');

    const emailId = generateId();
    
    // Change button text 
    cloneButton.innerText = "Tracking...";
   
    // Scrape the values
    const emailContainer = composeWindow.closest('.M9') || document;

    // Scrape the Subject
    const subjectInput = emailContainer.querySelector('input[name="subjectbox"]');
    const subject = (subjectInput && subjectInput.value) ? subjectInput.value : 'No Subject';

   
    
    // Scrape the Recipient(s)
    const toInputs = emailContainer.querySelectorAll('input[name="to"]');
    let recipients = [];
    toInputs.forEach(input => {
        if (input.value && !recipients.includes(input.value)) {
            recipients.push(input.value);
        }
    });

  
    if (recipients.length === 0) {
        const emailChips = emailContainer.querySelectorAll('[data-hovercard-id]');
        emailChips.forEach(chip => {
            const id = chip.getAttribute('data-hovercard-id');
            if (id && id.includes('@') && !recipients.includes(id)) {
                recipients.push(id);
            }
        });
    }

    const recipient = recipients.length > 0 ? recipients.join(', ') : 'Unknown Recipient';

    
    const hyperlinks = composeWindow.querySelectorAll('a');
    const originalLinks = [];
    hyperlinks.forEach(link => {
        if (link.href && !link.href.startsWith('mailto:')) {
            originalLinks.push(link.href);
        }
    });

    try {
        
        const response = await fetch(`${NGROK_URL}/api/create-track`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ emailId, recipient, subject, originalLinks })
        });
        
        const data = await response.json();
        

      if (data.status === 'success') {
            chrome.storage.local.get({ trackedEmails: [] }, function(result) {
                const list = result.trackedEmails;
                list.unshift({
                    emailId: emailId,
                    recipient: recipient,
                    subject: subject,
                    timestamp: new Date().toISOString()
                });
                // Keep only the last 50 emails to keep storage lightweight
                if (list.length > 50) list.pop();
                
                chrome.storage.local.set({ trackedEmails: list });
            });

            // Rewrite links
            hyperlinks.forEach((link, index) => {
                if (link.href && !link.href.startsWith('mailto:')) {
                    link.href = `${NGROK_URL}/click/${emailId}/${index}`;
                }
            });
        }

        //Inject pixel
        const pixelImg = document.createElement('img');
        pixelImg.src = `${NGROK_URL}/track/${emailId}.gif`;
        pixelImg.width = 1;
        pixelImg.height = 1;
        pixelImg.style.display = 'none';
        composeWindow.appendChild(pixelImg);

        console.log(`FoxTrack tracked ID: ${emailId}`);
    } catch (err) {
        console.error('FoxTrack tracking failed:', err);
    } finally {
        composeWindow.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Give Gmail 100ms to save the updated draft before clicking send
        setTimeout(() => {
            realSendButton.click();
        }, 100);
    }
}

let observerTimeout = null;

const domObserver = new MutationObserver(() => {
    if (observerTimeout) clearTimeout(observerTimeout);

    observerTimeout = setTimeout(() => {
        // Ignore our own clones
        const sendButtons = document.querySelectorAll('div[role="button"][data-tooltip^="Send"]:not(.foxtrack-fake-btn)');
        
        sendButtons.forEach(realButton => {
            if (!realButton.getAttribute('data-foxtrack-override')) {
                realButton.setAttribute('data-foxtrack-override', 'true');
                
                const composeBox = realButton.closest('.M9'); 
                let composeWindow = null;
                if(composeBox) {
                   composeWindow = composeBox.querySelector('div[aria-label="Message Body"][contenteditable="true"]');
                } else {
                   composeWindow = document.querySelector('div[aria-label="Message Body"][contenteditable="true"]');
                }

                if (!composeWindow) return;

                const cloneButton = realButton.cloneNode(true);
                cloneButton.removeAttribute('id');
                // Tag our clone so it doesn't get cloned again
                cloneButton.classList.add('foxtrack-fake-btn');
                
                cloneButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    executeTrackingAndSend(composeWindow, realButton, cloneButton);
                });

                realButton.style.display = 'none';
                realButton.parentNode.insertBefore(cloneButton, realButton);
            }
        });
    }, 250);
});

domObserver.observe(document.body, { childList: true, subtree: true });
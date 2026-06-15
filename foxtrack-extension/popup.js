const BACKEND_URL = 'https://foxtrack-email-tracking-firefox.onrender.com';

document.addEventListener('DOMContentLoaded', async () => {
    const listContainer = document.getElementById('email-list');

    //Fetch our stored list of tracked email IDs
    chrome.storage.local.get({ trackedEmails: [] }, async (result) => {
        const emails = result.trackedEmails;

        if (emails.length === 0) return;
        listContainer.innerHTML = ''; 

        // Loop through each tracked email and grab fresh real-time data from backend
        for (const email of emails) {
            const card = document.createElement('div');
            card.className = 'email-card';
            
            // Build temporary skeleton structure
            card.innerHTML = `
                <div class="card-header">
                    <span>To: ${escapeHtml(email.recipient)}</span>
                </div>
                <div class="subject">${escapeHtml(email.subject)}</div>
                <div class="stats-row">
                    <span>Loading live history...</span>
                </div>
            `;
            listContainer.appendChild(card);

          
          // Fetch telemetry data for this individual tracker
            try {
                const res = await fetch(`${BACKEND_URL}/status/${email.emailId}`);
                if (!res.ok) throw new Error('Not found');
                const data = await res.json();

                const badgeClass = data.totalReads > 0 ? 'read' : 'unread';
                const badgeText = data.totalReads > 0 ? `${data.totalReads} Views` : 'Unread';
                
                // Smart Timestamp Selection for the Email Open
                let displayTime = `Sent: ${formatTime(email.timestamp)}`;
                if (data.totalReads > 0 && data.readHistory && data.readHistory.length > 0) {
    displayTime = `Opened: ${formatTime(data.readHistory[0].timestamp)}`;
}

               
                let linkClicksText = '';
                let linkDetailsHTML = ''; // This will hold our new UI rows
                
                if (data.linksMetadata && data.linksMetadata.length > 0) {
                    let totalClicks = 0;
                    
                    data.linksMetadata.forEach(link => {
                        if (link.clicks && link.clicks.length > 0) {
                            totalClicks += link.clicks.length;
                            
                            
                            const firstClickTime = formatTime(link.clicks[0].timestamp);
                            
                            
                            const cleanUrl = link.originalUrl.length > 35 
                                ? link.originalUrl.substring(0, 35) + '...' 
                                : link.originalUrl;
                            
                        
                            linkDetailsHTML += `
                                <div style="font-size: 10px; color: #1a73e8; margin-top: 6px; padding-top: 4px; border-top: 1px dotted #e0e0e0; display: flex; justify-content: space-between;">
                                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 65%;">🔗 ${escapeHtml(cleanUrl)}</span>
                                    <span style="color: #666; white-space: nowrap;">${firstClickTime}</span>
                                </div>
                            `;
                        }
                    });
                    
                    if (totalClicks > 0) linkClicksText = ` | Clicks: ${totalClicks}`;
                }

                // Inject the main stats AND the new link details below it
                card.querySelector('.stats-row').innerHTML = `
                    <div style="width: 100%;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span class="status-badge ${badgeClass}">${badgeText}${linkClicksText}</span>
                            <span style="color:#888;">${displayTime}</span>
                        </div>
                        ${linkDetailsHTML}
                    </div>
                `;
            } catch (err) {
                card.querySelector('.stats-row').innerHTML = `
                    <span style="color: #c5221f;">Server unreachable</span>
                `;
            }
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const clearBtn = document.getElementById('clear-history');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            // Confirm before deleting
            if (confirm("Are you sure you want to clear your local tracking history?")) {
                //Erase the memory
                chrome.storage.local.set({ trackedEmails: [] }, () => {
                    // Instantly reset the UI to the empty state
                    const listContainer = document.getElementById('email-list');
                    listContainer.innerHTML = '<div class="empty-state">History cleared. Send a new email!</div>';
                });
            }
        });
    }
});


function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
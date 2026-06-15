require('dotenv').config();
const express = require('express');
const cors = require('cors');
const useragent = require('useragent');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase Connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to identify if a device is mobile or desktop
function getDeviceType(userAgentString) {
    if (!userAgentString) return 'Unknown';
    
    if (userAgentString.includes('GoogleImageProxy')) {
        return 'Gmail App / Proxy';
    }

    const agent = useragent.parse(userAgentString);
    const os = agent.os.toString().toLowerCase();
    
    if (os.includes('android') || os.includes('ios') || os.includes('iphone') || os.includes('ipad')) {
        return 'Mobile';
    }
    return 'Desktop';
}


// CREATE TRACKING ENTRY (Saved to Supabase 'emails' table)
app.post('/api/create-track', async (req, res) => {
    const { emailId, recipient, subject, originalLinks } = req.body;
    
    if (!emailId) {
        return res.status(400).json({ status: 'error', message: 'Missing ID' });
    }

    const { error } = await supabase
        .from('emails')
        .insert([
            { 
                email_id: emailId, 
                recipient: recipient || 'Unknown', 
                subject: subject || 'No Subject', 
                original_links: originalLinks || [] 
            }
        ]);

    if (error) {
        console.error('Supabase Error:', error.message);
        return res.status(500).json({ status: 'error', message: 'Database failed' });
    }

    console.log(`[Supabase] Created tracker for: ${emailId}`);
    res.json({ status: 'success' });
});


// PIXEL TRACKING ENDPOINT (Saved to Supabase 'reads' table)
app.get('/track/:emailId.gif', async (req, res) => {
    const emailId = req.params.emailId;
    const uAgent = req.headers['user-agent'];
    const device = getDeviceType(uAgent);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Instantly return the invisible pixel to the email client
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(pixel);

    // Asynchronously log the read into Supabase
    const { error } = await supabase
        .from('reads')
        .insert([
            { 
                email_id: emailId, 
                user_agent: device, 
                ip_address: ip 
            }
        ]);

    if (error) {
        console.error(`[Supabase] Failed to log read for ${emailId}:`, error.message);
    } else {
        console.log(`[Supabase] Real read detected for email: ${emailId}`);
    }
});


// LINK CLICK REDIRECTION ENDPOINT (Saved to Supabase 'clicks' table)
app.get('/click/:emailId/:linkIndex', async (req, res) => {
    const { emailId, linkIndex } = req.params;
    const index = parseInt(linkIndex, 10);

    // Ask Supabase for the original URL
    const { data: emailData, error: fetchError } = await supabase
        .from('emails')
        .select('original_links')
        .eq('email_id', emailId)
        .single();

    if (fetchError || !emailData || !emailData.original_links || !emailData.original_links[index]) {
        return res.status(404).send('Link destination not found.');
    }

    const targetUrl = emailData.original_links[index];
    const uAgent = req.headers['user-agent'];
    const device = getDeviceType(uAgent);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Redirect the user instantly so they don't wait
    res.redirect(targetUrl);

    //Asynchronously log the click into Supabase
    const { error: insertError } = await supabase
        .from('clicks')
        .insert([
            {
                email_id: emailId,
                link_index: index,
                original_url: targetUrl,
                user_agent: device,
                ip_address: ip
            }
        ]);

    if (insertError) {
        console.error(`[Supabase] Failed to log click for ${emailId}:`, insertError.message);
    } else {
        console.log(`[Supabase] Click logged for email: ${emailId}`);
    }
});


// FETCH STATUS ENDPOINT (Pulls combined tables from Supabase for popup.js)
app.get('/status/:emailId', async (req, res) => {
    const emailId = req.params.emailId;

    // Fetch Email Main Data
    const { data: emailData, error: emailError } = await supabase
        .from('emails')
        .select('*')
        .eq('email_id', emailId)
        .single();

    if (emailError || !emailData) {
        return res.status(404).json({ error: 'Tracking ID not found' });
    }

    // Fetch Reads
    const { data: readsData } = await supabase
        .from('reads')
        .select('timestamp, user_agent')
        .eq('email_id', emailId)
        .order('timestamp', { ascending: true });

    // Fetch Clicks
    const { data: clicksData } = await supabase
        .from('clicks')
        .select('*')
        .eq('email_id', emailId)
        .order('timestamp', { ascending: true });

    // Group the clicks specifically to match the format popup.js is expecting
    let formattedLinks = [];
    if (emailData.original_links && emailData.original_links.length > 0) {
        formattedLinks = emailData.original_links.map((url, i) => {
            const specificClicks = clicksData ? clicksData.filter(c => c.link_index === i) : [];
            return {
                originalUrl: url,
                clicks: specificClicks.map(c => ({ 
                    timestamp: c.timestamp, 
                    device: c.user_agent 
                }))
            };
        });
    }

    // Evaluate expiration rule (48 hours)
    const timeElapsed = new Date() - new Date(emailData.created_at);
    const isExpired = timeElapsed > 172800000;
    const alertTriggered = isExpired && (!readsData || readsData.length === 0);

    // Send the fully constructed JSON back to the extension
    res.json({
        recipient: emailData.recipient,
        subject: emailData.subject,
        totalReads: readsData ? readsData.length : 0,
        readHistory: readsData || [],
        linksMetadata: formattedLinks,
        alertTriggered: alertTriggered,
        isExpired: isExpired
    });
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log('Advanced Tracking Server running on ${PORT}'));
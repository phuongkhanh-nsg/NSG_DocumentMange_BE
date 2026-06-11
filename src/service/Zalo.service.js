const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const sendNewDocumentZalo = async (phones, docData) => {
    try {
        if (!phones || phones.length === 0) return;
        
        const zaloToken = process.env.ZALO_ACCESS_TOKEN;
        if (!zaloToken) {
            console.log("ZALO_ACCESS_TOKEN is missing. Skipping Zalo notification for:", phones);
            return;
        }

        // Example Zalo ZNS API Call (requires OA access token and template ID)
        // const url = 'https://business.openapi.zalo.me/message/template';
        
        // This is a stub implementation. Replace with actual Zalo ZNS or OA message structure
        for (const phone of phones) {
            /* 
            const data = {
                phone: phone, // must format phone number e.g., 849xxxx
                template_id: "YOUR_TEMPLATE_ID",
                template_data: {
                    docCode: docData.docCode,
                    shortDescription: docData.shortDescription,
                    docType: docData.docType === "received" ? "Văn bản đến" : "Văn bản đi",
                }
            };
            
            await axios.post(url, data, {
                headers: {
                    'access_token': zaloToken,
                    'Content-Type': 'application/json'
                }
            });
            */
            console.log(`[STUB] Zalo notification sent to ${phone} for document ${docData.docCode}`);
        }
    } catch (error) {
        console.error("Error sending Zalo notification:", error.response ? error.response.data : error.message);
    }
};

module.exports = {
    sendNewDocumentZalo
};

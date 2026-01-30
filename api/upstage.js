const FormData = require('form-data');

module.exports = async function handler(req, res) {
    // CORS 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const API_KEY = process.env.UPSTAGE_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        const { endpoint, body, isFormData } = req.body;

        let fetchOptions = {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`
            }
        };

        if (isFormData) {
            // Document Parse API - FormData 처리
            const formData = new FormData();

            formData.append('model', body.model || 'document-parse');
            formData.append('ocr', body.ocr || 'force');
            formData.append('output_formats', body.output_formats || "['text', 'markdown']");
            formData.append('mode', body.mode || 'enhanced');

            // Base64로 인코딩된 파일 데이터 처리
            if (body.document) {
                const buffer = Buffer.from(body.document.data, 'base64');
                formData.append('document', buffer, {
                    filename: body.document.filename,
                    contentType: body.document.contentType
                });
            }

            fetchOptions.body = formData;
            fetchOptions.headers = {
                ...fetchOptions.headers,
                ...formData.getHeaders()
            };
        } else {
            // Chat API - JSON 처리
            fetchOptions.headers['Content-Type'] = 'application/json';
            fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(endpoint, fetchOptions);
        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        return res.status(500).json({ error: error.message });
    }
};

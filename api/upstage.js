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
        console.error('UPSTAGE_API_KEY is not set');
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        const { endpoint, body, isFormData } = req.body;

        console.log('Request to endpoint:', endpoint);
        console.log('isFormData:', isFormData);

        if (isFormData) {
            // Document Parse API - FormData 처리
            const formData = new FormData();

            // 필수 파라미터
            formData.append('model', body.model || 'document-parse');

            // 선택적 파라미터 (값이 있을 때만 추가)
            if (body.ocr) {
                formData.append('ocr', body.ocr);
            }
            if (body.output_formats) {
                formData.append('output_formats', body.output_formats);
            }
            if (body.mode) {
                formData.append('mode', body.mode);
            }

            // Base64로 인코딩된 파일 데이터 처리
            if (body.document) {
                const buffer = Buffer.from(body.document.data, 'base64');
                formData.append('document', buffer, {
                    filename: body.document.filename,
                    contentType: body.document.contentType
                });
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    ...formData.getHeaders()
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('Upstage API error:', response.status, data);
                return res.status(response.status).json(data);
            }

            return res.status(200).json(data);
        } else {
            // Chat API - JSON 처리
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('Upstage Chat API error:', response.status, data);
                return res.status(response.status).json(data);
            }

            return res.status(200).json(data);
        }
    } catch (error) {
        console.error('Proxy error:', error);
        return res.status(500).json({ error: error.message });
    }
};

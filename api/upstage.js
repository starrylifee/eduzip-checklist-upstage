const FormData = require('form-data');
const https = require('https');

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
            // Document Parse API - FormData 처리 (https 모듈 사용)
            const formData = new FormData();

            // 필수 파라미터
            formData.append('model', body.model || 'document-parse');

            // 선택적 파라미터
            if (body.ocr) {
                formData.append('ocr', body.ocr);
            }

            // Base64로 인코딩된 파일 데이터 처리
            if (body.document) {
                const buffer = Buffer.from(body.document.data, 'base64');
                formData.append('document', buffer, {
                    filename: body.document.filename,
                    contentType: body.document.contentType
                });
            }

            // form-data 패키지의 submit 메서드 대신 직접 요청
            const url = new URL(endpoint);

            return new Promise((resolve, reject) => {
                const request = https.request({
                    method: 'POST',
                    host: url.host,
                    path: url.pathname,
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`,
                        ...formData.getHeaders()
                    }
                }, (response) => {
                    let data = '';
                    response.on('data', chunk => data += chunk);
                    response.on('end', () => {
                        try {
                            const jsonData = JSON.parse(data);
                            if (response.statusCode >= 400) {
                                console.error('Upstage API error:', response.statusCode, jsonData);
                                res.status(response.statusCode).json(jsonData);
                            } else {
                                res.status(200).json(jsonData);
                            }
                            resolve();
                        } catch (e) {
                            console.error('JSON parse error:', e, data);
                            res.status(500).json({ error: 'Failed to parse response' });
                            resolve();
                        }
                    });
                });

                request.on('error', (error) => {
                    console.error('Request error:', error);
                    res.status(500).json({ error: error.message });
                    resolve();
                });

                formData.pipe(request);
            });
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

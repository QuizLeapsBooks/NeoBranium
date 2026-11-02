import crypto from 'crypto';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_FEATURES = new Set([
    'ai_assistant',
    'ai_board',
    'doubt_solver',
    'general',
    'neobot',
    'neoboard',
    'neolens',
    'question_paper'
]);

export function parseAiImageDataUri(image, declaredMimeType) {
    if (typeof image !== 'string') return null;
    const match = image.match(/^(?:data:(image\/(?:jpeg|png|webp));base64,)?([A-Za-z0-9+/]+={0,2})$/i);
    if (!match) return null;

    const mimeType = (match[1] || declaredMimeType || '').toLowerCase();
    const encoded = match[2];
    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) return null;
    if (encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || encoded.length % 4 !== 0) return null;

    const imageBuffer = Buffer.from(encoded, 'base64');
    if (
        imageBuffer.toString('base64') !== encoded ||
        imageBuffer.length > MAX_IMAGE_BYTES ||
        imageBuffer.length < 10
    ) return null;

    let actualMimeType = null;
    if (imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8 && imageBuffer[2] === 0xff) {
        actualMimeType = 'image/jpeg';
    } else if (imageBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        actualMimeType = 'image/png';
    } else if (
        imageBuffer.length >= 12 &&
        imageBuffer.toString('ascii', 0, 4) === 'RIFF' &&
        imageBuffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
        actualMimeType = 'image/webp';
    }

    if (actualMimeType !== mimeType) return null;
    return { imageBuffer, mimeType };
}

function isDocumentId(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function createAiUploadHandler({ verifyAuthToken, db, isCloudinaryConfigured, cloudinary }) {
    return async function uploadAiImage(req, res) {
        try {
            let userId = req.uid;
            if (!userId) {
                try {
                    userId = (await verifyAuthToken(req))?.uid;
                } catch (authError) {
                    const unavailable = authError.message?.includes('Service Unavailable');
                    return res.status(unavailable ? 503 : 401).json({
                        success: false,
                        error: unavailable ? 'Authentication service is unavailable.' : 'Please sign in before uploading.'
                    });
                }
            }
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Please sign in before uploading.' });
            }
            if (!db) {
                return res.status(503).json({ success: false, error: 'Firestore database is unavailable.' });
            }
            if (!isCloudinaryConfigured?.() || !cloudinary?.uploader) {
                return res.status(503).json({ success: false, error: 'Cloudinary image storage is unavailable.' });
            }

            const { image, mimeType, feature, conversationId, uploadId } = req.body || {};
            if (!ALLOWED_FEATURES.has(feature) || !isDocumentId(conversationId)) {
                return res.status(400).json({ success: false, error: 'A valid feature and conversation are required.' });
            }

            const conversationRef = db.collection('users').doc(userId).collection('conversations').doc(conversationId);
            const conversation = await conversationRef.get();
            if (
                !conversation.exists ||
                conversation.data().isDeleted ||
                conversation.data().userId !== userId ||
                conversation.data().feature !== feature
            ) {
                return res.status(404).json({ success: false, error: 'Conversation not found.' });
            }

            const parsedImage = parseAiImageDataUri(image, mimeType);
            if (!parsedImage) {
                return res.status(400).json({
                    success: false,
                    error: 'Choose a valid JPEG, PNG, or WebP image no larger than 5 MiB.'
                });
            }

            const safeUploadId = typeof uploadId === 'string' && /^[a-zA-Z0-9-]{8,40}$/.test(uploadId)
                ? uploadId
                : crypto.randomUUID();
            const folder = `neobranium/users/${userId}/ai/${feature}/conversations/${conversationId}`;
            const expectedPublicId = `${folder}/${safeUploadId}`;

            let uploaded;
            try {
                uploaded = await cloudinary.uploader.upload(
                    `data:${parsedImage.mimeType};base64,${parsedImage.imageBuffer.toString('base64')}`,
                    {
                        folder,
                        public_id: safeUploadId,
                        overwrite: true,
                        invalidate: true,
                        resource_type: 'image',
                        unique_filename: false,
                        use_filename: false,
                        transformation: [
                            { width: 2000, height: 2000, crop: 'limit', quality: 'auto', fetch_format: 'auto' }
                        ]
                    }
                );
            } catch (error) {
                console.error('[AI Upload] Cloudinary upload failed.', error.http_code || error.name || 'unknown');
                return res.status(502).json({
                    success: false,
                    error: 'The image could not be uploaded to Cloudinary. Please try again.'
                });
            }

            if (
                uploaded.public_id !== expectedPublicId ||
                typeof uploaded.secure_url !== 'string' ||
                !uploaded.secure_url.startsWith('https://res.cloudinary.com/')
            ) {
                console.error('[AI Upload] Cloudinary returned an unexpected asset reference.');
                return res.status(502).json({
                    success: false,
                    error: 'The image could not be stored safely. Please try again.'
                });
            }

            return res.json({
                success: true,
                secure_url: uploaded.secure_url,
                public_id: uploaded.public_id,
                width: uploaded.width,
                height: uploaded.height,
                format: uploaded.format,
                uploadId: safeUploadId
            });
        } catch (error) {
            console.error('[AI Upload] Unexpected upload handler failure:', error.message);
            return res.status(500).json({ success: false, error: 'Server error processing image upload.' });
        }
    };
}

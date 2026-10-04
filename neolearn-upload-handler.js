const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function parseNeoLearnImageDataUri(image, declaredMimeType) {
    if (typeof image !== 'string') return null;
    const match = image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i);
    if (!match) return null;

    const mimeType = match[1].toLowerCase();
    const encoded = match[2];
    if (!ALLOWED_IMAGE_TYPES.has(mimeType) || mimeType !== String(declaredMimeType || '').toLowerCase()) return null;
    if (encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || encoded.length % 4 !== 0) return null;

    const imageBuffer = Buffer.from(encoded, 'base64');
    if (imageBuffer.toString('base64') !== encoded || imageBuffer.length > MAX_IMAGE_BYTES) return null;

    let actualMimeType = null;
    if (imageBuffer.length >= 3 && imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8 && imageBuffer[2] === 0xff) {
        actualMimeType = 'image/jpeg';
    } else if (imageBuffer.length >= 8 && imageBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
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

export function createNeoLearnUploadHandler({ verifyAuthToken, isCloudinaryConfigured, cloudinary, db, admin }) {
    return async function uploadNeoLearnPost(req, res) {
        let userId;
        try {
            let decodedToken;
            try {
                decodedToken = await verifyAuthToken(req);
            } catch (authError) {
                const isAuthServiceUnavailable = authError.message?.startsWith('Service Unavailable');
                return res.status(isAuthServiceUnavailable ? 503 : 401).json({
                    success: false,
                    error: isAuthServiceUnavailable ? 'Authentication service is unavailable.' : 'Please sign in before uploading.'
                });
            }

            userId = decodedToken?.uid;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Please sign in before uploading.' });
            }
            if (!isCloudinaryConfigured()) {
                return res.status(503).json({ success: false, error: 'Image storage is not configured.' });
            }
            if (!db) {
                return res.status(503).json({ success: false, error: 'Post storage is not available.' });
            }

            const { image, mimeType, description, uploadId } = req.body || {};
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uploadId || '')) {
                return res.status(400).json({ success: false, error: 'Invalid upload session. Close and reopen the upload dialog.' });
            }
            if (typeof description !== 'string' || description.length > 500) {
                return res.status(400).json({ success: false, error: 'Description must be 500 characters or fewer.' });
            }

            const parsedImage = parseNeoLearnImageDataUri(image, mimeType);
            if (!parsedImage) {
                return res.status(400).json({
                    success: false,
                    error: 'Choose a valid JPEG, PNG, or WebP image no larger than 5 MiB.'
                });
            }

            const postRef = db.collection('neolearn_posts').doc(`${userId}_${uploadId}`);
            const existingPost = await postRef.get();
            if (existingPost.exists) {
                const existingData = existingPost.data();
                if (existingData.userId !== userId || existingData.uploadId !== uploadId) {
                    return res.status(409).json({ success: false, error: 'This upload session is already in use.' });
                }
                return res.json({
                    success: true,
                    alreadyCreated: true,
                    postId: postRef.id,
                    imageUrl: existingData.imageUrl,
                    uploadId
                });
            }

            const expectedPublicId = `neobranium/users/${userId}/neolearn/post-${uploadId}`;
            let cloudinaryResult;
            try {
                cloudinaryResult = await cloudinary.uploader.upload(
                    `data:${parsedImage.mimeType};base64,${parsedImage.imageBuffer.toString('base64')}`,
                    {
                        folder: `neobranium/users/${userId}/neolearn`,
                        public_id: `post-${uploadId}`,
                        overwrite: true,
                        invalidate: true,
                        resource_type: 'image',
                        transformation: [
                            { width: 1600, height: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }
                        ]
                    }
                );
            } catch (uploadError) {
                console.error('NeoLearn Cloudinary upload failed:', uploadError.message);
                return res.status(502).json({ success: false, error: 'The image could not be uploaded. Please try again.' });
            }

            const postData = {
                userId,
                imageUrl: cloudinaryResult.secure_url,
                cloudinaryPublicId: cloudinaryResult.public_id || expectedPublicId,
                description: description.trim(),
                uploadId,
                mimeType: parsedImage.mimeType,
                fileSizeBytes: parsedImage.imageBuffer.length,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            try {
                await postRef.create(postData);
            } catch (firestoreError) {
                const concurrentPost = await postRef.get().catch((lookupError) => {
                    console.error('NeoLearn Firestore recovery lookup failed:', lookupError.message);
                    return null;
                });
                if (concurrentPost?.exists && concurrentPost.data().userId === userId && concurrentPost.data().uploadId === uploadId) {
                    return res.json({
                        success: true,
                        alreadyCreated: true,
                        postId: postRef.id,
                        imageUrl: concurrentPost.data().imageUrl,
                        uploadId
                    });
                }

                let cleanupSucceeded = false;
                if (concurrentPost && !concurrentPost.exists) {
                    try {
                        await cloudinary.uploader.destroy(postData.cloudinaryPublicId, { resource_type: 'image', invalidate: true });
                        cleanupSucceeded = true;
                    } catch (cleanupError) {
                        console.error('NeoLearn orphan cleanup failed:', cleanupError.message);
                    }
                }
                console.error('NeoLearn Firestore write failed:', firestoreError.message);
                return res.status(503).json({
                    success: false,
                    stage: 'firestore',
                    retrySafe: true,
                    cleanupSucceeded,
                    uploadId,
                    error: 'The image reached storage, but its post could not be saved. Retry Share to safely continue.'
                });
            }

            return res.status(201).json({
                success: true,
                postId: postRef.id,
                imageUrl: postData.imageUrl,
                uploadId
            });
        } catch (error) {
            if (!userId) {
                const isAuthServiceUnavailable = error.message?.startsWith('Service Unavailable');
                return res.status(isAuthServiceUnavailable ? 503 : 401).json({
                    success: false,
                    error: isAuthServiceUnavailable ? 'Authentication service is unavailable.' : 'Please sign in before uploading.'
                });
            }
            console.error('Error in /api/neolearn/upload-post:', error.message);
            return res.status(500).json({ success: false, error: 'The post could not be created. Please try again.' });
        }
    };
}
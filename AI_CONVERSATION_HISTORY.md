# AI conversation history

Signed-in users can browse, continue, and soft-delete conversations for NeoBot,
NeoLens, NeoBoard, AI Board, the AI assistant, and question-paper generation.
Conversation and message data is stored in Firestore under the authenticated
user's `users/{uid}/conversations/{conversationId}` path. Clients use the
authenticated conversation API; Firestore rules deny direct client writes.

Conversation images are validated by the server and stored in Cloudinary under
the corresponding user, feature, and conversation path. Only supported JPEG,
PNG, and WebP files up to 5 MiB are accepted. Guest question-paper generation
continues to use its existing ownership-token flow and does not create history
or upload history images.

Deleting a conversation or message is a soft delete. Deleted records are hidden
from history APIs and marked deleted in Firestore; Cloudinary assets are not
destroyed as part of deletion. No automated retention or asset-cleanup period
is currently configured, so deleted records and images remain stored until an
approved retention policy and cleanup process are established.

Conversation lists are cursor-paginated. Message history restores up to the
most recent 200 messages in chronological order. Image bytes are not retained
in Firestore; messages retain validated Cloudinary references.

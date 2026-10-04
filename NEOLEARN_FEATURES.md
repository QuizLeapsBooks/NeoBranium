# NeoLearn Feature List

NeoLearn is an authenticated peer-learning space for discovering learners, sharing study moments, and following other profiles.

## Access and Navigation

- Sign-in protected pages and authenticated server requests.
- Desktop sidebar/header navigation and mobile quick navigation.
- Theme toggle on NeoLearn pages.
- Shared notification badge in desktop and mobile navigation.
- Loading skeletons, retry controls, empty states, and error messages on data-driven pages.

## Home and Feed

- Learning feed displays posts from profiles the current user follows.
- Discovery feed can show posts from learners the user does not already follow.
- Suggested learner list shows up to six profiles not yet followed, with a Learn action.
- Feed and suggestions use session cache to render previously loaded content sooner.
- Post visibility counts are stored per user in local storage; a post is dismissed from the current feed after being viewed three times.
- Separate empty states explain when there are no followed profiles or no available posts.
- Feed cards clean up realtime listeners when removed.

## Peers and Learning Relationships

- Browse NeoLearn profiles in the Peers directory.
- Search peers by name, username, or bio; show result counts and a no-match state.
- Peer cards show profile photo, name, username, bio, Learn count, Learning count, and post count.
- Learn/Unlearn toggle updates relationship counts and its own button state.
- Profile links are available from peer cards and suggested learners.

## Profiles

- Public profile shows photo, name, username, bio, relationship counts, post count, Thought of the Day, and shared posts.
- Profile owner sees their own score, high score, rank, and profile-edit/settings link.
- Owner can view Learn/Learning connection lists and edit their Thought of the Day (up to 280 characters).
- Post grids support loading additional posts and opening a post from a notification deep link.
- The profile owner has a **Blocked users** section listing blocked profiles, with direct Unblock actions.
- A blocked profile shows its blocked status and an Unblock action; that user's posts are hidden until unblocked.

## Image Posts

- Upload a single JPG, PNG, or WebP image, up to 5 MiB.
- Validate actual image format, non-empty file, and maximum 40-megapixel dimensions.
- Crop presets: landscape 4:3, square 1:1, and wide 16:9.
- Drag to pan the crop; zoom from 1x to 3x; rotate left or right.
- Image adjustments: original, monochrome, warm, or soft-color filter, plus brightness, contrast, and saturation.
- Optional caption/description, up to 500 characters, with a live character count.
- Preview before sharing; output is optimized to WebP with a 1600-pixel maximum edge.
- Upload progress/busy state, validation errors, retry messaging, and success feedback.
- Post cards link to the author's profile, show post date and image, and open an expanded post-detail dialog.
- Owners can edit captions or delete their posts; deletion also attempts Cloudinary image and RTDB interaction cleanup.
- Non-owners can report a post.

## Likes and Comments

- Like/unlike action with a live like count and pressed state.
- Optimistic like feedback with recovery on failure and a retry state if like data cannot load.
- Live comment count on each post; opening the comment panel starts its realtime listener.
- Add comments up to 500 characters; comments show author profile links, photo/name, and date.
- Comment text is rendered as text, not HTML; listeners are detached when the panel closes or post is removed.

## Notifications

- Realtime notifications for likes and comments on the signed-in user's posts.
- Newest-first ordering, unread dot, relative time, and optional comment preview.
- Actor name/photo link opens their profile; View post opens the related post.
- Opening an unread notification marks it read; a button marks all notifications as read.
- Unread count updates in the navigation badge; loading, empty, retry, and error states are provided.

## Reporting and Blocking

- Report a post or profile with one of four reasons: Spam, Inappropriate content, Harassment, or Other.
- Prevent duplicate reports by the same reporter for the same post/profile; users cannot report their own profile.
- Block and unblock profiles through confirmation dialogs.
- Blocking removes Learning relationships in both directions and excludes the blocked profile's posts from the blocker's feed.
- Blocked-user management is available from the owner's profile page; each entry links to the profile and has an Unblock button.

## Storage and Services

- **Firestore:** NeoLearn profiles, post metadata, Learning relationships, reports, and block records.
- **Realtime Database:** Post likes, comments, and per-user notifications/read state.
- **Cloudinary:** Uploaded post images.
- **Express API:** Authenticated endpoints handle uploads, social actions, notifications, reports, and blocks.

## Main Pages

- `htmls/neolearn/index.html` — Home feed, suggestions, and image upload/editor.
- `htmls/neolearn/peers.html` — Peer directory and search.
- `htmls/neolearn/profile.html` — Own or public profile, posts, connections, and blocked-user management.
- `htmls/neolearn/notifications.html` — Realtime notification list and read controls.
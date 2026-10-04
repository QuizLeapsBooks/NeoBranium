const fs = require('fs');
let code = fs.readFileSync('htmls/neolearn/profile.html', 'utf-8');

const oldFunc = \`    async function loadProfile(loadMore = false) {
      if (!activeUser) return;
      loading.hidden = false;
      error.hidden = true;
      missing.hidden = true;
      if (!loadMore) {
        content.hidden = true;
        postsOffset = 0;
        profileTargetId = targetIdFromUrl || activeUser.uid;
      }
      try {
        const result = await getNeoLearnProfile(activeUser, profileTargetId, postsOffset);
        const profile = result.profile;\`;

const newFunc = \`    const renderProfileData = (result, loadMore) => {
        const profile = result.profile;
        document.title = \\\`\${profile.name || 'NeoProfile'} | NeoLearn\\\`;
        document.getElementById('neoLearnProfilePageTitle').textContent = result.isOwner ? 'NeoProfile' : 'Learner profile';
        document.getElementById('neoLearnPeerName').textContent = profile.name || 'NeoLearn learner';
        const avatarHost = document.getElementById('neoLearnPeerAvatar');
        avatarHost.replaceChildren();
        if (profile.profilePhotoUrl) {
          const avatar = document.createElement('img');
          avatar.className = 'nl-social-avatar';
          avatar.src = profile.profilePhotoUrl;
          avatar.alt = \\\`\${profile.name || 'Learner'} profile photo\\\`;
          avatar.loading = 'lazy';
          avatarHost.append(avatar);
        } else {
          const fallback = document.createElement('span');
          fallback.className = 'nl-social-avatar nl-social-avatar-fallback';
          fallback.textContent = (profile.name || 'L').trim().charAt(0).toUpperCase();
          fallback.setAttribute('aria-label', \\\`\${profile.name || 'Learner'} profile photo unavailable\\\`);
          avatarHost.append(fallback);
        }

        document.getElementById('neoLearnPeerUsername').textContent = profile.username ? \\\`@\${profile.username}\\\` : '';
        document.getElementById('neoLearnPeerBio').textContent = profile.bio || '';
        document.getElementById('neoLearnPeerPostsCount').textContent = String(profile.postsCount ?? result.posts.length);
        document.getElementById('neoLearnPeerLearnCount').textContent = String(profile.learnCount ?? 0);
        document.getElementById('neoLearnPeerLearningCount').textContent = String(profile.learningCount ?? 0);

        const actions = document.getElementById('neoLearnPeerActions');
        actions.replaceChildren();
        if (result.isOwner) {
          const editButton = document.createElement('a');
          editButton.className = 'nl-social-button nl-social-button--secondary';
          editButton.href = '/htmls/setting.html#neolearnSection';
          editButton.innerHTML = '<i class="bi bi-pencil" aria-hidden="true"></i> Edit Profile';
          actions.append(editButton);
        } else {
          const learnButton = document.createElement('button');
          learnButton.type = 'button';
          learnButton.className = 'nl-social-button nl-social-button--primary';
          learnButton.textContent = profile.isLearning ? 'Learning' : 'Learn';
          learnButton.classList.toggle('nl-social-button--secondary', profile.isLearning);
          learnButton.classList.toggle('nl-social-button--primary', !profile.isLearning);
          const status = document.createElement('span');
          status.className = 'nl-social-inline-status';
          status.setAttribute('role', 'status');
          learnButton.addEventListener('click', async () => {
            const wasLearning = profile.isLearning === true;
            learnButton.disabled = true;
            learnButton.textContent = wasLearning ? 'Unlearning...' : 'Learning...';
            learnButton.setAttribute('aria-busy', 'true');
            status.textContent = '';
            try {
              const summary = await toggleLearn(profile.userId, wasLearning);
              profile.isLearning = summary.isLearning;
              profile.learnCount = summary.learnCount;
              document.getElementById('neoLearnPeerLearnCount').textContent = String(summary.learnCount);
              document.getElementById('neoLearnPeerLearningCount').textContent = String(summary.viewerLearningCount ?? profile.learningCount);
              learnButton.textContent = summary.isLearning ? 'Learning' : 'Learn';
              learnButton.classList.toggle('nl-social-button--secondary', summary.isLearning);
              learnButton.classList.toggle('nl-social-button--primary', !summary.isLearning);
            } catch (actionError) {
              learnButton.textContent = wasLearning ? 'Learning' : 'Learn';
              status.textContent = actionError.message;
            } finally {
              learnButton.disabled = false;
              learnButton.removeAttribute('aria-busy');
            }
          });

          const menuWrap = document.createElement('div');
          menuWrap.className = 'nl-post-menu-wrap';
          const menuBtn = document.createElement('button');
          menuBtn.type = 'button';
          menuBtn.className = 'nl-post-menu-btn nl-social-button nl-social-button--secondary';
          menuBtn.setAttribute('aria-label', 'Profile options');
          menuBtn.setAttribute('aria-haspopup', 'true');
          menuBtn.setAttribute('aria-expanded', 'false');
          menuBtn.innerHTML = '<i class="bi bi-three-dots" aria-hidden="true"></i>';

          const menuDropdown = document.createElement('div');
          menuDropdown.className = 'nl-post-menu-dropdown';
          menuDropdown.hidden = true;

          const blockedBadge = document.createElement('span');
          blockedBadge.className = 'nl-social-inline-status';
          blockedBadge.style.color = 'var(--account-danger)';
          blockedBadge.textContent = profile.isBlocked ? 'Blocked' : '';

          const unblockBtn = document.createElement('button');
          unblockBtn.type = 'button';
          unblockBtn.className = 'nl-social-button nl-social-button--secondary';
          unblockBtn.textContent = 'Unblock';
          unblockBtn.hidden = !profile.isBlocked;
          unblockBtn.addEventListener('click', () => {
             showReportDialog({
              title: 'Unblock User',
              message: 'Are you sure you want to unblock this user? They will be able to see your shared learning moments again.',
              confirmText: 'Unblock',
              onConfirm: async () => {
                await unblockNeoLearnUser(profile.userId, activeUser);
                await loadProfile();
              }
            });
          });

          if (profile.isBlocked) {
            actions.append(blockedBadge, unblockBtn);
            return;
          }

          const blockItem = document.createElement('button');
          blockItem.type = 'button';
          blockItem.className = 'nl-post-menu-item';
          blockItem.innerHTML = '<i class="bi bi-slash-circle me-2" aria-hidden="true"></i> Block User';
          blockItem.addEventListener('click', (e) => {
            e.stopPropagation();
            menuDropdown.hidden = true;
            showReportDialog({
              title: 'Block User',
              message: 'Are you sure you want to block this user?',
              confirmText: 'Block User',
              danger: true,
              onConfirm: async () => {
                await blockNeoLearnUser(profile.userId, activeUser);
                await loadProfile();
              }
            });
          });

          const reportItem = document.createElement('button');
          reportItem.type = 'button';
          reportItem.className = 'nl-post-menu-item';
          reportItem.innerHTML = '<i class="bi bi-flag me-2" aria-hidden="true"></i> Report Profile';
          reportItem.addEventListener('click', (e) => {
            e.stopPropagation();
            menuDropdown.hidden = true;
            showReportDialog({
              title: 'Report Profile',
              itemType: 'profile',
              onReport: (reason) => reportNeoLearnProfile(profile.userId, reason, activeUser)
            });
          });

          menuDropdown.append(blockItem, reportItem);
          menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = menuDropdown.hidden;
            document.querySelectorAll('.nl-post-menu-dropdown').forEach((d) => { d.hidden = true; });
            menuDropdown.hidden = !isHidden;
            menuBtn.setAttribute('aria-expanded', String(!isHidden));
          });
          menuWrap.append(menuBtn, menuDropdown);
          actions.append(learnButton, status, menuWrap);
        }

        savedThought = profile.thoughtOfTheDay || '';
        viewingOwner = result.isOwner;
        thoughtText.textContent = savedThought;
        thoughtText.hidden = !savedThought;
        thoughtSection.hidden = result.isBlocked || (!savedThought && !result.isOwner);
        document.getElementById('editNeoLearnThought').hidden = !result.isOwner || !savedThought;
        thoughtEditor.hidden = !result.isOwner || Boolean(savedThought);
        thoughtInput.value = savedThought;
        thoughtCount.textContent = \\\`\${thoughtInput.value.length}/280\\\`;
        const postsGrid = document.getElementById('neoLearnPeerPostsGrid');
        if (!loadMore) {
          Array.from(postsGrid.children).forEach((child) => {
            if (child.cleanupRtdb) child.cleanupRtdb();
          });
          postsGrid.replaceChildren();
        }
        result.posts.forEach((post) => {
          const card = renderPostCard(post, profile, detailDialog);
          card.id = \\\`post-\${post.postId}\\\`;
          postsGrid.append(card);
        });
        postsOffset = result.nextPostOffset;
        document.getElementById('loadMoreNeoLearnPeerPosts').hidden = result.isBlocked || !result.hasMorePosts;
        const emptyState = document.getElementById('neoLearnPeerPostsEmpty');
        if (result.isBlocked) {
          emptyState.hidden = false;
          emptyState.querySelector('h3').textContent = 'User blocked';
          emptyState.querySelector('p').textContent = 'You have blocked this user. Unblock to view their shared moments.';
          document.getElementById('neoLearnPeerPostsSubtitle').textContent = 'Posts are hidden because this user is blocked.';
        } else {
          emptyState.hidden = (profile.postsCount ?? result.posts.length) > 0;
          emptyState.querySelector('h3').textContent = 'No posts yet';
          emptyState.querySelector('p').textContent = 'There are no shared learning moments here yet.';
          document.getElementById('neoLearnPeerPostsSubtitle').textContent = result.isOwner ? 'Your posts shared on NeoLearn.' : 'Posts shared on NeoLearn.';
        }
        content.hidden = false;
    };

    async function loadProfile(loadMore = false) {
      if (!activeUser) return;
      let hasRenderedCache = false;
      const cacheKey = 'neolearnProfileCache_' + (targetIdFromUrl || activeUser.uid);
      
      if (!loadMore) {
        profileTargetId = targetIdFromUrl || activeUser.uid;
        postsOffset = 0;
        const cachedStr = sessionStorage.getItem(cacheKey);
        if (cachedStr) {
          try {
            const cachedResult = JSON.parse(cachedStr);
            renderProfileData(cachedResult, loadMore);
            hasRenderedCache = true;
          } catch(e) {}
        }
      }
      
      if (!hasRenderedCache) {
        loading.hidden = false;
        error.hidden = true;
        missing.hidden = true;
        if (!loadMore) {
          content.hidden = true;
        }
      } else {
        loading.hidden = true;
      }
      
      try {
        const result = await getNeoLearnProfile(activeUser, profileTargetId, postsOffset);
        if (!loadMore) sessionStorage.setItem(cacheKey, JSON.stringify(result));
        renderProfileData(result, loadMore);
\`;

let idx = code.indexOf(oldFunc);
if (idx === -1) {
   console.log("Could not find oldFunc");
   process.exit(1);
}

// Find the end of the block to replace. It ends at `content.hidden = false;` right before `if (window.location.hash`
let endIdx = code.indexOf('content.hidden = false;', idx);
if (endIdx === -1) {
   console.log("Could not find content.hidden = false;");
   process.exit(1);
}
endIdx += 'content.hidden = false;'.length;

code = code.substring(0, idx) + newFunc + code.substring(endIdx);
fs.writeFileSync('htmls/neolearn/profile.html', code);
console.log('patched successfully');

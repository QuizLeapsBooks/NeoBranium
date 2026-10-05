import re

with open('server.js', 'r') as f:
    js = f.read()

# I need to update neoLearnDirectoryHandlers to include messagePrivacy in loadPublicProfile?
# No, loadPublicProfile is in neolearn-directory-handler.js

with open('neolearn-directory-handler.js', 'r') as f:
    handler = f.read()

if 'messagePrivacy' not in handler:
    handler = handler.replace('learningCount: profileData.learningCount', 'learningCount: profileData.learningCount,\n        messagePrivacy: profileData.messagePrivacy || userData.messagePrivacy || "everyone"')
    with open('neolearn-directory-handler.js', 'w') as f:
        f.write(handler)
    print("Patched neolearn-directory-handler.js")

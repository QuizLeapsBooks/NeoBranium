import re

with open('js/neolearn-messages.js', 'r') as f:
    js = f.read()

# Add a block check to the composer submit
block_check = """
  // Check Privacy and Blocks
  if (activePeer.isBlocked) {
      return showError('You have blocked this user or they have blocked you.');
  }
  if (activePeer.messagePrivacy === 'none') {
      return showError('This user does not accept messages.');
  }
  if (activePeer.messagePrivacy === 'learning_only') {
      if (!activePeer.isLearning && !activePeer.isLearnedByViewer) {
          return showError('This user only accepts messages from learning connections.');
      }
  }
"""

if "activePeer.messagePrivacy" not in js:
    js = js.replace('const text = input.value.trim();\n  const uid = auth.currentUser?.uid;\n  if (!text || !uid || !activePeer) return;',
                    'const text = input.value.trim();\n  const uid = auth.currentUser?.uid;\n  if (!text || !uid || !activePeer) return;\n' + block_check)
    with open('js/neolearn-messages.js', 'w') as f:
        f.write(js)
    print("Patched neolearn-messages.js privacy")

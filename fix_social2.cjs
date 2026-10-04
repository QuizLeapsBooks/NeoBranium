const fs = require('fs');
let uiCode = fs.readFileSync('js/neolearn-social-ui.js', 'utf8');

uiCode = uiCode.replace(
  /if \(!likeButton\.disabled\) \{\s*applyLikeState\(liked, count\);\s*\}/,
  `if (!likeButton.classList.contains('is-processing')) {
      applyLikeState(liked, count);
    }`
);

fs.writeFileSync('js/neolearn-social-ui.js', uiCode);

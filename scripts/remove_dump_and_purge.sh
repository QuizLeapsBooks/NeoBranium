#!/usr/bin/env bash
# Remove local dump.rdb and guide on purging it from git history.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [ -f dump.rdb ]; then
  echo "Removing dump.rdb from workspace and staging removal..."
  git rm --quiet --ignore-unmatch dump.rdb || true
  rm -f dump.rdb || true
  git commit -m "chore(secrets): remove dump.rdb" || true
  echo "Removed and committed. To fully purge from history consider using 'git filter-repo' or BFG."
else
  echo "No dump.rdb file found in repository root."
fi

cat <<'EOF'
Recommended steps to purge dump.rdb from git history (run interactively):

# 1) Install git-filter-repo (preferred):
#    pip install git-filter-repo
# 2) Run (backup your repo first):
#    git clone --mirror <repo-url> repo-mirror.git
#    cd repo-mirror.git
#    git filter-repo --invert-paths --path dump.rdb
#    git push --force

# Alternative using BFG (simpler for files):
#    java -jar bfg.jar --delete-files dump.rdb repo.git
#    cd repo.git
#    git reflog expire --expire=now --all && git gc --prune=now --aggressive
#    git push --force

# After purge: rotate any credentials that may have been exposed.
EOF

echo "Script finished."

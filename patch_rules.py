import re
import json

with open('database.rules.json', 'r') as f:
    rules = json.load(f)

rules['rules']['neolearn_realtime']['presence'] = {
    "$userId": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid === $userId",
        ".validate": "newData.hasChildren(['state', 'last_changed']) && newData.child('state').isString() && newData.child('last_changed').isNumber()"
    }
}

with open('database.rules.json', 'w') as f:
    json.dump(rules, f, indent=2)

print("Patched RTDB rules")

#!/bin/bash
# Patch: Add liner_notes to AI analysis pipeline
# Run this script from the vinyl-app-deploy directory on the NAS via SSH
# Usage: ssh fraadmin@192.168.0.250 "cd /path/to/vinyl-app-deploy && bash apply_liner_notes_patch.sh"

set -e

echo "🔧 Patching openai.js..."
python3 << 'PYEOF'
import os

# --- 1. Patch openai.js ---
fp = 'src/lib/openai.js'
with open(fp, 'r') as f:
    c = f.read()

old1 = '- notes (Detailed description including: history of the album/artist, interesting anecdotes, trivia, recording context, and musical influence. Make it engaging and comprehensive approx 300-500 words)'
new1 = old1 + "\n- liner_notes (A rich, engaging narrative story about this album. Write as if you are composing liner notes for the vinyl sleeve. Include the story behind the recording sessions, the cultural context of the era, band dynamics, and the album's lasting legacy. Approx 400-600 words. Write in a warm, journalistic tone.)"
c = c.replace(old1, new1)

old2 = '        notes: parsed.notes || parsed.note || "Analyzed by AI"'
new2 = '        notes: parsed.notes || parsed.note || "Analyzed by AI",\n        liner_notes: parsed.liner_notes || ""'
c = c.replace(old2, new2)

with open(fp, 'w') as f:
    f.write(c)
print(f"  ✅ {fp} patched ({len(c)} chars)")

# --- 2. Patch VinylCard.jsx ---
fp = 'src/components/VinylCard.jsx'
with open(fp, 'r') as f:
    c = f.read()

old = "                edition: String(analysis.edition || '').substring(0, 100)\n            };\n\n            // CRITICAL: Respect User Validation"
new = "                edition: String(analysis.edition || '').substring(0, 100),\n                liner_notes: String(analysis.liner_notes || '').substring(0, 5000)\n            };\n\n            // CRITICAL: Respect User Validation"
c = c.replace(old, new)

with open(fp, 'w') as f:
    f.write(c)
print(f"  ✅ {fp} patched ({len(c)} chars)")

# --- 3. Patch VinylGrid.jsx ---
fp = 'src/components/VinylGrid.jsx'
with open(fp, 'r') as f:
    c = f.read()

old = "                        edition: String(analysis.edition || '').substring(0, 100)\n                    };\n\n                    if (vinyl.is_tracks_validated)"
new = "                        edition: String(analysis.edition || '').substring(0, 100),\n                        liner_notes: String(analysis.liner_notes || '').substring(0, 5000)\n                    };\n\n                    if (vinyl.is_tracks_validated)"
c = c.replace(old, new)

with open(fp, 'w') as f:
    f.write(c)
print(f"  ✅ {fp} patched ({len(c)} chars)")

# --- 4. Patch VinylDetailModal.jsx ---
fp = 'src/components/VinylDetailModal.jsx'
with open(fp, 'r') as f:
    c = f.read()

old = "                edition: analysis.edition || vinyl.edition || ''\n            };\n\n            // Respect User Validation"
new = "                edition: analysis.edition || vinyl.edition || '',\n                liner_notes: String(analysis.liner_notes || '').substring(0, 5000)\n            };\n\n            // Respect User Validation"
c = c.replace(old, new)

with open(fp, 'w') as f:
    f.write(c)
print(f"  ✅ {fp} patched ({len(c)} chars)")

print("\n🎉 All files patched successfully!")
PYEOF

echo ""
echo "✅ Patch complete! Rebuild with: npm run build"

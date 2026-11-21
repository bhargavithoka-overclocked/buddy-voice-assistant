import re

# "hey buddy", plus the ways speech recognition likes to mishear it
# (the same pattern as frontend/src/audio/wakeWord.js)
WAKE_PHRASE = re.compile(r"\b(hey|hi|hay|ok|okay)[\s,.!]*bud+(y|dy|ie)?\b", re.IGNORECASE)


def is_wake_phrase(text: str) -> bool:
    return bool(WAKE_PHRASE.search(text))

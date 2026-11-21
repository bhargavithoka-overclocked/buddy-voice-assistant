"""
Cuts a streamed reply into sentences, so each one can be turned into
speech while the rest of the reply is still being written.
"""

import re

# end of a sentence (. ! ? maybe followed by quotes/brackets, then whitespace) or a line break
BREAK = re.compile(r'[.!?…]+["\')\]]*\s+|\n+')

# a short piece like "Sure." sounds choppy on its own, so it gets joined to the next sentence
MIN_LENGTH = 25


def clean_for_speech(text: str) -> str:
    """Strip markdown that would otherwise be read out loud."""
    text = re.sub(r"[*_`#>]+", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)  # [link](url) -> link
    text = re.sub(r"^\s*[-•]\s+", "", text, flags=re.MULTILINE)
    return re.sub(r"\s+", " ", text).strip()


async def split_sentences(chunks):
    buffer = ""
    async for chunk in chunks:
        buffer += chunk
        search_from = 0
        while match := BREAK.search(buffer, search_from):
            is_line_break = match.group()[0] == "\n"
            if match.end() < MIN_LENGTH and not is_line_break:
                search_from = match.end()
                continue
            sentence = clean_for_speech(buffer[: match.end()])
            buffer = buffer[match.end():]
            search_from = 0
            if sentence:
                yield sentence

    leftover = clean_for_speech(buffer)
    if leftover:
        yield leftover

import asyncio

from app.sentences import clean_for_speech, split_sentences


async def chunks(*parts):
    for part in parts:
        yield part


def split(*parts):
    async def run():
        return [s async for s in split_sentences(chunks(*parts))]

    return asyncio.run(run())


def test_splits_across_chunks():
    sentences = split("The weather is lovely tod", "ay. Do you want to go for a ", "walk? I think it would be fun!")
    assert sentences == ["The weather is lovely today.", "Do you want to go for a walk?", "I think it would be fun!"]


def test_short_bits_are_joined():
    # "Sure." on its own would sound choppy
    assert split("Sure. Here is the plan for tomorrow morning. ") == ["Sure. Here is the plan for tomorrow morning."]


def test_numbers_dont_split():
    assert split("It costs 3.50 dollars at the shop down the road.") == ["It costs 3.50 dollars at the shop down the road."]


def test_newlines_break_sentences():
    sentences = split("Here are three ideas for you\n- go hiking in the hills\n- visit the museum")
    assert sentences == ["Here are three ideas for you", "go hiking in the hills", "visit the museum"]


def test_clean_for_speech():
    assert clean_for_speech("**Wow**, check [this site](https://x.com) `now`") == "Wow, check this site now"

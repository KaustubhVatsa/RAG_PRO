from app.config import Settings
from app.llm.client import DiskCache


def test_role_falls_back_to_shared_endpoint():
    s = Settings(
        _env_file=None,  # never read a developer's local .env in a unit test
        llm_base_url="https://shared",
        llm_api_key="k",
        llm_judge_base_url="https://judge",
    )
    assert s.role_config("main")[:2] == ("https://shared", "k")
    assert s.role_config("judge")[:2] == ("https://judge", "k")


def test_disk_cache_roundtrip(tmp_path):
    cache = DiskCache(tmp_path)
    key = DiskCache.key(model="m", messages=[{"role": "user", "content": "hi"}])
    assert cache.get(key) is None
    cache.put(key, {"text": "yo", "model": "m"})
    assert cache.get(key)["text"] == "yo"


def test_throttle_spaces_calls_apart():
    import time

    from app.llm.client import Throttle

    t = Throttle(rpm=600)  # 0.1 s between calls
    start = time.monotonic()
    for _ in range(4):
        t.wait()
    assert time.monotonic() - start >= 0.28  # 3 gaps of ~0.1 s (the first call is free)

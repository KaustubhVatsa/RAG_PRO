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

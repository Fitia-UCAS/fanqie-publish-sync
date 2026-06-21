from __future__ import annotations

from backend.features.crawling.sites.lanmeiwen import LanmeiwenAdapter
from backend.features.crawling.sites.renrenreshu import RenrenreshuAdapter
from backend.features.crawling.sites.xsbook import XsbookAdapter
from backend.features.crawling.sites.site_adapter import NovelSiteAdapter
from backend.features.crawling.sites.site_registry import ADAPTER_TYPES, adapter_for_url, supported_sites

__all__ = [
    "ADAPTER_TYPES",
    "LanmeiwenAdapter",
    "XsbookAdapter",
    "NovelSiteAdapter",
    "RenrenreshuAdapter",
    "adapter_for_url",
    "supported_sites",
]

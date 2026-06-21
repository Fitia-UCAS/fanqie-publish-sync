from __future__ import annotations

from dataclasses import dataclass

from backend.features.publishing.use_cases import PublishChapters
from backend.features.story_analysis.character_material import CharacterMaterialService
from backend.features.story_analysis.current_plot import CurrentPlotService
from backend.features.syncing.use_cases import SyncChapters


@dataclass(slots=True)
class ApplicationServices:
    publishing: PublishChapters
    syncing: SyncChapters
    character_material: CharacterMaterialService
    current_plot: CurrentPlotService


def create_application_services() -> ApplicationServices:
    return ApplicationServices(
        publishing=PublishChapters(),
        syncing=SyncChapters(),
        character_material=CharacterMaterialService(),
        current_plot=CurrentPlotService(),
    )

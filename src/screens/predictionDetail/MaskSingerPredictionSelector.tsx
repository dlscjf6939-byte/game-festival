import React from 'react';
import {ParticipantPosterCarousel, type PosterParticipant} from './ParticipantPosterCarousel';

type MaskSingerPredictionSelectorProps = {
  onSelectTeam: (teamId: string) => void;
  selectedTeamId: string;
  teams: PosterParticipant[];
};

export function MaskSingerPredictionSelector({
  onSelectTeam,
  selectedTeamId,
  teams,
}: MaskSingerPredictionSelectorProps): JSX.Element {
  return <ParticipantPosterCarousel teams={teams} selectedTeamId={selectedTeamId} onSelectTeam={onSelectTeam} />;
}

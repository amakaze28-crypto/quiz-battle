import { rankInfo } from './rank.js';
import { getEmperorSet } from './emperors.js';
import { settings } from './settings.js';

export const iconUrl = (iconId) => (iconId && iconId !== 'default' ? `/icon/${iconId}` : null);

export function profilePayload(u, isAdmin = false) {
  return {
    uid: u.uid, displayName: u.displayName, email: u.email, iconId: u.iconId || 'default',
    pt: u.pt, mr: u.mr, isMaster: !!u.isMaster, wins: u.wins || 0, losses: u.losses || 0, games: u.games || 0,
    coins: u.coins || 0, friendCode: u.friendCode, nameChanges: u.nameChanges || 0,
    nameCost: (u.nameChanges || 0) === 0 ? 0 : settings().renameCost,
    isAdmin: !!isAdmin, rank: rankInfo(u, getEmperorSet()),
  };
}
